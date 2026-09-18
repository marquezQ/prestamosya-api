import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  ApiGetMonthlyHistoryDoc,
  ApiGetMonthlyPdfDoc,
  ApiGetMonthlyStatsDoc,
} from './stats.docs';
import { StatsService } from './stats.service';
import { QueryMonthlyHistoryDto } from './dto/query-monthly-history.dto';
import { QueryMonthlyStatsDto } from './dto/query-monthly-stats.dto';
import { getTodayLaPaz } from '../../common/utils/date.utils';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * GET /api/stats/monthly?year=2026&month=9
   *
   * Reporte completo del mes. Si year/month se omiten, usa el mes actual
   * según la zona horaria del negocio (America/La_Paz).
   */
  @Get('monthly')
  @ApiGetMonthlyStatsDoc()
  async getMonthlyStats(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMonthlyStatsDto,
  ) {
    const today = getTodayLaPaz();
    const year = query.year ?? today.getUTCFullYear();
    const month = query.month ?? today.getUTCMonth() + 1; // getUTCMonth() es 0-indexed

    const data = await this.statsService.getMonthlyStats(user.sub, year, month);

    return {
      data,
      message: 'Monthly stats report generated successfully',
    };
  }

  /**
   * GET /api/stats/monthly-history?months=6
   *
   * Historial resumido de los últimos N meses para gráficas.
   * El primer ítem del arreglo es el mes más reciente.
   */
  @Get('monthly-history')
  @ApiGetMonthlyHistoryDoc()
  async getMonthlyHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMonthlyHistoryDto,
  ) {
    const months = query.months ?? 6;
    const data = await this.statsService.getMonthlyHistory(user.sub, months);

    return {
      data,
      message: 'Monthly history generated successfully',
    };
  }
  /**
   * GET /api/stats/monthly-pdf?year=2026&month=9
   *
   * Genera el PDF de balance de pagos del mes y lo envía como attachment.
   *
   * Compatibilidad con clientes:
   *   – Next.js: fetch() → response.blob() → URL.createObjectURL(blob) → <a download>
   *   – React Native Expo: FileSystem.downloadAsync(url, path, { headers: { Authorization } })
   *     o FileSystem.writeAsStringAsync + Sharing.shareAsync()
   *
   * CORS ya está habilitado globalmente en main.ts con app.enableCors().
   * Los headers Content-Disposition y Content-Type son los estándar de la industria
   * para descarga de archivos y son manejados correctamente por ambos clientes.
   */
  @Get('monthly-pdf')
  @ApiGetMonthlyPdfDoc()
  async getMonthlyPdf(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMonthlyStatsDto,
    @Res() res: Response,
  ): Promise<void> {
    const today = getTodayLaPaz();
    const year = query.year ?? today.getUTCFullYear();
    const month = query.month ?? today.getUTCMonth() + 1;

    const buffer = await this.statsService.generateMonthlyPaymentsPdf(
      user.sub,
      year,
      month,
    );

    const monthPadded = String(month).padStart(2, '0');
    const filename = `balance-pagos-${year}-${monthPadded}.pdf`;

    // Estos headers son compatibles con:
    //   - fetch API (Next.js)
    //   - XMLHttpRequest
    //   - expo-file-system FileSystem.downloadAsync
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      // Permite que el frontend acceda a estos headers en CORS cross-origin
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });

    res.end(buffer);
  }
}
