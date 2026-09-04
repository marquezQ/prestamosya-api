import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HomeDashboardResponseDto } from './dto/home-dashboard-response.dto';

export function ApiGetHomeDashboardDoc() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Obtener métricas y resumen financiero del Home (Dashboard Principal)',
      description:
        'Devuelve en una sola respuesta el Capital en Calle (desglosado por BOB y USD), resumen global de préstamos, resumen de clientes y la lista de cuotas vencidas (morosos) priorizada para cobranza.',
    }),
    ApiResponse({
      status: 200,
      description: 'Métricas del Home recuperadas exitosamente',
      type: HomeDashboardResponseDto,
    }),
  );
}
