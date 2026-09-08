import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryMonthlyStatsDto {
  @ApiPropertyOptional({
    default: new Date().getFullYear(),
    description:
      'Año del período a consultar (ej: 2026). Por defecto: año actual.',
    minimum: 2020,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    default: new Date().getMonth() + 1,
    description: 'Mes del período a consultar (1-12). Por defecto: mes actual.',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
