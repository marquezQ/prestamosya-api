import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LA_PAZ_TIMEZONE } from '../../../common/utils/date.utils';
import { NotificationsService } from '../notifications.service';

/**
 * Cron resumen diario 8:00AM (America/La_Paz) — reutiliza el MISMO
 * GetPaymentDashboardUseCase que web/APK, entrega in-app SIEMPRE (fiable) +
 * push Expo best-effort opcional. Ambos canales fallan GRACIOSAMENTE.
 */
@Injectable()
export class DailySummaryCron {
  private readonly logger = new Logger(DailySummaryCron.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: LA_PAZ_TIMEZONE })
  async handleDailySummary(): Promise<void> {
    try {
      const results = await this.notificationsService.sendDailySummaries();
      this.logger.log(`[Resumen] admin(s) entregados: ${results.length}`);
    } catch (error) {
      this.logger.error(
        `[Resumen] fallo: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
