import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApiGetMonthlyHistoryDoc, ApiGetMonthlyStatsDoc } from './stats.docs';
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
}
