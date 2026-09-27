import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayLaPaz } from '../../common/utils/date.utils';
import { Role, NotificationType } from '../../generated/prisma/client';
import { GetPaymentDashboardUseCase } from '../loans/application/use-cases/get-payment-dashboard.use-case';
import {
  NotificationChannelSender,
  NotificationChannelPortToken,
} from './providers/notification-channel.port';
import {
  PushSender,
  PushProviderPortToken,
  PushSendResult,
} from './providers/push-provider.port';
import { NotificationItemDto } from './dto/notification-item.dto';
import { ListNotificationsQuery } from './dto/list-notifications.query.dto';

export interface NotificationListResult {
  items: NotificationItemDto[];
  total: number;
  page: number;
  perPage: number;
  unread: number;
}

export interface DailySummaryDeliveryResult {
  userId: string;
  overdueClients: number;
  dueTodayCount: number;
  inAppDelivered: boolean;
  pushAccepted: number;
  pushFailed: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly getDashboard: GetPaymentDashboardUseCase,
    @Inject(NotificationChannelPortToken)
    private readonly channel: NotificationChannelSender,
    @Inject(PushProviderPortToken)
    private readonly push: PushSender,
  ) {}

  async listForUser(
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<NotificationListResult> {
    const page = Math.max(1, Number(query.page ?? 1));
    const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? 20)));

    const where = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items: items.map(
        (n): NotificationItemDto => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          payload: n.payload
            ? (n.payload as Record<string, unknown>)
            : undefined,
          readAt: n.readAt,
          createdAt: n.createdAt,
        }),
      ),
      total,
      page,
      perPage,
      unread,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  /**
   * Registra el token de push del dispositivo del usuario (Expo / FCM / WebPush).
   * Usa upsert para evitar duplicados si el mismo token se registra más de una vez
   * (ej. al abrir la app varias veces sin cerrar sesión).
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { userId_platform_token: { userId, platform, token } },
      create: { userId, platform, token },
      update: {},
    });
  }

  /**
   * Elimina el token de push al cerrar sesión para que el usuario
   * no reciba notificaciones en un dispositivo que ya cerró sesión.
   */
  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });
  }

  /**
   * Resumen diario 8AM America/La_Paz a cada admin activo.
   * Canal in-app SIEMPRE (fiable, persiste en BD).
   * Canal push Expo best-effort OPCIONAL (no rompe el flujo si falla).
   * Se envía SIEMPRE, aunque los contadores sean 0.
   */
  async sendDailySummaries(): Promise<DailySummaryDeliveryResult[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.admin, isActive: true },
      select: { id: true },
    });

    const results: DailySummaryDeliveryResult[] = [];

    for (const admin of admins) {
      try {
        const dashboard = await this.getDashboard.execute(
          admin.id,
          getTodayLaPaz().toISOString().split('T')[0],
        );

        const dueTodayCount = dashboard?.dueToday?.length ?? 0;
        const overdueClients = dashboard?.overdue
          ? new Set(dashboard.overdue.map((i) => i.clientId)).size
          : 0;

        const title = 'Resumen diario';
        const body = `${dueTodayCount} cobro(s) para hoy · ${overdueClients} cliente(s) en mora`;

        // ── Canal In-App (siempre, fiable) ─────────────────────────────────
        let inAppDelivered = false;
        try {
          inAppDelivered = await this.channel.send({
            userId: admin.id,
            type: NotificationType.DAILY_SUMMARY,
            title,
            body,
            payload: { dueTodayCount, overdueClients },
          });
        } catch (error) {
          this.logger.error(
            `[InApp] admin=${admin.id} falló: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // ── Canal Push Expo (best-effort, opcional) ─────────────────────────
        let pushResult: PushSendResult = { accepted: 0, failed: 0 };
        try {
          pushResult = await this.push.sendToUser(admin.id, {
            title,
            body,
            payload: { dueTodayCount, overdueClients },
          });
        } catch (error) {
          this.logger.error(
            `[Push] admin=${admin.id} falló: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        results.push({
          userId: admin.id,
          overdueClients,
          dueTodayCount,
          inAppDelivered,
          pushAccepted: pushResult.accepted,
          pushFailed: pushResult.failed,
        });
      } catch (error) {
        this.logger.error(
          `[Resumen] admin=${admin.id} error general: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return results;
  }
}
