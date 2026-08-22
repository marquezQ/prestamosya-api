import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class QueryPaymentDashboardDto {
  @ApiPropertyOptional({
    default: '2026-08-20',
    description:
      'Fecha seleccionada en el carrusel/agenda de la UI (formato YYYY-MM-DD). Si no se envía, asume la fecha actual de hoy.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;
}
