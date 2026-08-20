import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LA_PAZ_TIMEZONE } from '../../common/utils/date.utils';
import { OverdueProcessorService } from './services/overdue-processor.service';

/**
 * Tarea programada (Cron Job) para el recálculo automático de mora.
 *
 * Se ejecuta diariamente a las 6:00 AM hora local de Bolivia (America/La_Paz UTC-4).
 */
@Injectable()
export class OverdueCron {
  private readonly logger = new Logger(OverdueCron.name);

  constructor(private readonly overdueProcessor: OverdueProcessorService) {}

  @Cron('0 6 * * *', {
    name: 'check-overdue-installments',
    timeZone: LA_PAZ_TIMEZONE,
  })
  async handleCron(): Promise<void> {
    this.logger.log(
      `[OverdueCron] ⏰ Disparo automático programado (6:00 AM ${LA_PAZ_TIMEZONE})...`,
    );

    try {
      await this.overdueProcessor.processOverdue();
    } catch (error) {
      this.logger.error(
        `[OverdueCron] ❌ Error durante el recálculo automático de mora:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
