import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoansModule } from '../loans/loans.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DailySummaryCron } from './cron/daily-summary.cron';
import { InAppNotificationProvider } from './providers/in-app-notification.provider';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { NotificationChannelPort } from './providers/notification-channel.port';
import { PushProviderPort } from './providers/push-provider.port';

/**
 * Módulo de notificaciones.
 *
 * Canales:
 *   - In-App (REST): persiste en tabla `notifications` — SIEMPRE fiable.
 *   - Push Expo:     envía a tokens registrados en `device_tokens` — best-effort.
 *
 * ScheduleModule ya está registrado globalmente en CronModule (app root).
 * LoansModule ya exporta GetPaymentDashboardUseCase — no se duplica aquí.
 */
@Module({
  imports: [PrismaModule, LoansModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DailySummaryCron,
    InAppNotificationProvider,
    ExpoPushProvider,
    { provide: NotificationChannelPort, useClass: InAppNotificationProvider },
    { provide: PushProviderPort, useClass: ExpoPushProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
