import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryMonthlyHistoryDto {
  @ApiPropertyOptional({
    default: 6,
    description:
      'Cantidad de meses a incluir en el historial (1-24). Por defecto: 6 últimos meses.',
    minimum: 1,
    maximum: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
