import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MonthlyStatsResponseDto } from './dto/monthly-stats-response.dto';
import { MonthlyHistoryItemDto } from './dto/monthly-history-response.dto';

export function ApiGetMonthlyStatsDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reporte mensual de rendimiento financiero',
      description:
        'Devuelve el balance completo de un mes: ingresos de interés cobrado, ' +
        'capital recuperado, rendimiento de cobranza, indicadores de riesgo, ' +
        'balance neto y top de clientes morosos. ' +
        'Si no se especifican year/month, devuelve el mes en curso.',
    }),
    ApiQuery({
      name: 'year',
      required: false,
      type: Number,
      example: 2026,
      description: 'Año del período (ej: 2026). Default: año actual.',
    }),
    ApiQuery({
      name: 'month',
      required: false,
      type: Number,
      example: 9,
      description: 'Mes del período (1-12). Default: mes actual.',
    }),
    ApiResponse({
      status: 200,
      description: 'Reporte mensual generado exitosamente',
      type: MonthlyStatsResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Parámetros inválidos (year/month fuera de rango)',
    }),
  );
}

export function ApiGetMonthlyHistoryDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Historial mensual de estadísticas (para gráficas)',
      description:
        'Devuelve un arreglo resumido de los últimos N meses con métricas clave ' +
        'para construir gráficas de barras o líneas en el frontend. ' +
        'El índice 0 es el mes más reciente. Default: últimos 6 meses.',
    }),
    ApiQuery({
      name: 'months',
      required: false,
      type: Number,
      example: 6,
      description: 'Cantidad de meses a incluir (1-24). Default: 6.',
    }),
    ApiResponse({
      status: 200,
      description: 'Historial mensual generado exitosamente',
      type: [MonthlyHistoryItemDto],
    }),
  );
}
