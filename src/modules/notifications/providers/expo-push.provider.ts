import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PushSender, PushSendResult } from './push-provider.port';

/**
 * Push vía Expo Push Service — CANAL OPCIONAL best-effort.
 * Si no hay tokens expo ni EXPO_ACCESS_TOKEN, no rompe NADA:
 * devuelve { accepted: 0, failed: 0 } silenciosamente.
 */
@Injectable()
export class ExpoPushProvider implements PushSender {
  private readonly logger = new Logger(ExpoPushProvider.name);
  private readonly client: Expo;

  constructor(private readonly prisma: PrismaService) {
    this.client = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    });
  }

  async sendToUser(
    userId: string,
    input: { title: string; body: string; payload?: Record<string, unknown> },
  ): Promise<PushSendResult> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, platform: 'expo' },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return { accepted: 0, failed: 0 };
    }

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: 'default' as const,
        title: input.title,
        body: input.body,
        data: input.payload ?? {},
      }));

    if (messages.length === 0) {
      return { accepted: 0, failed: 0 };
    }

    const chunks = this.client.chunkPushNotifications(messages);
    let accepted = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] =
          await this.client.sendPushNotificationsAsync(chunk);

        for (const ticket of tickets) {
          if (ticket.status === 'ok') {
            accepted++;
          } else {
            failed++;
            this.logger.warn(
              `[Expo] ticket error: ${ticket.message ?? 'unknown'}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `[Expo] chunk falló: ${error instanceof Error ? error.message : String(error)}`,
        );
        failed += chunk.length;
      }
    }

    return { accepted, failed };
  }
}
