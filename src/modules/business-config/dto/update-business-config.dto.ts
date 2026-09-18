// src/modules/business-config/dto/update-business-config.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO para actualizar la configuración del negocio del usuario autenticado.
 *
 * Todas las propiedades son opcionales (actualización parcial): solo se
 * persisten los campos enviados. Los campos `undefined` no se incluyen en el
 * `update` de Prisma.
 *
 * Nota de diseño: `username` no está aquí porque no es editable, y esta
 * configuración es independiente del perfil del usuario.
 */
export class UpdateBusinessConfigDto {
  @ApiPropertyOptional({
    description: 'Nombre del negocio',
    default: 'Préstamos Ya',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Moneda principal del negocio',
    default: 'BOB',
    enum: ['BOB', 'USD'],
  })
  @IsOptional()
  @IsIn(['BOB', 'USD'])
  primaryCurrency?: 'BOB' | 'USD';

  @ApiPropertyOptional({
    description:
      'Tasa de cambio referencial (USD → BOB). No convierte automáticamente.',
    default: 6.96,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({
    description: 'Tasa de interés por defecto (%)',
    default: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultInterestRate?: number;

  @ApiPropertyOptional({
    description: 'Período por defecto para el cronograma de cuotas',
    default: 'monthly',
    enum: ['daily', 'weekly', 'fortnightly', 'monthly', 'custom'],
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'fortnightly', 'monthly', 'custom'])
  defaultPeriodType?: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'custom';

  @ApiPropertyOptional({
    description: 'Días de gracia antes de marcar una cuota como en mora',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  graceDays?: number;
}
