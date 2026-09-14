// src/modules/business-config/dto/business-config-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Forma de respuesta de la configuración del negocio.
 *
 * Los montos/tasas Decimal de Prisma se exponen como `number` para consumo
 * inmediato del frontend (patrón del resto de la API).
 */
export class BusinessConfigResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiPropertyOptional({ example: 'Préstamos Ya', nullable: true })
  businessName: string | null;

  @ApiProperty({ example: 'BOB', enum: ['BOB', 'USD'] })
  primaryCurrency: 'BOB' | 'USD';

  @ApiProperty({ example: 6.96 })
  exchangeRate: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  defaultInterestRate: number | null;

  @ApiPropertyOptional({
    example: 'monthly',
    enum: ['daily', 'weekly', 'fortnightly', 'monthly', 'custom'],
    nullable: true,
  })
  defaultPeriodType:
    | 'daily'
    | 'weekly'
    | 'fortnightly'
    | 'monthly'
    | 'custom'
    | null;

  @ApiProperty({ example: 3 })
  graceDays: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
