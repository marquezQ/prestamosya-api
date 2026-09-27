import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NotificationChannelInput,
  NotificationChannelSender,
} from './notification-channel.port';

/**
 * Canal in-app: persiste en `notifications` (la MISMA tabla que sirve web y
 * APK). SIEMPRE FIABLE — canal obligatorio del sistema.
 */
@Injectable()
export class InAppNotificationProvider implements NotificationChannelSender {
  private readonly logger = new Logger(InAppNotificationProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(input: NotificationChannelInput): Promise<boolean> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          payload: input.payload as never,
        },
      });
      return true;
    } catch (error) {
      this.logger.error(
        `[InApp] persistencia falló: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
