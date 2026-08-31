import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * DTO para liquidar anticipadamente un préstamo con condonación de interés.
 *
 * Reglas:
 * - `amount` + `discount` DEBE igualar exactamente el `outstandingBalance` del préstamo.
 * - `discount` = 0 es válido (liquidación sin descuento: el cliente paga el total).
 * - El préstamo siempre pasa a estado COMPLETED al usar este endpoint.
 *
 * @example
 * ```json
 * {
 *   "loanId": "e69c1048-18e4-4a41-bbfb-bfdf0d0b0101",
 *   "amount": 1100.00,
 *   "discount": 100.00,
 *   "method": "cash",
 *   "paymentDate": "2026-10-20",
 *   "notes": "Liquidación anticipada. Interés del mes 3 condonado."
 * }
 * ```
 */
export class SettleLoanDto {
  @ApiProperty({ default: 'e69c1048-18e4-4a41-bbfb-bfdf0d0b0101' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  loanId: string;

  @ApiProperty({
    default: 1100,
    description:
      'Monto en efectivo o transferencia que el cliente entrega físicamente.',
  })
  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  amount: number;

  @ApiProperty({
    default: 100,
    description:
      'Interés futuro condonado por el prestamista. Puede ser 0 si se liquida sin descuento. El total (amount + discount) debe igualar el saldo pendiente del préstamo.',
  })
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  discount: number;

  @ApiProperty({ default: 'cash', enum: ['cash', 'transfer'] })
  @IsString()
  @IsIn(['cash', 'transfer'])
  method: 'cash' | 'transfer';

  @ApiProperty({ default: '2026-10-20' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'paymentDate must be in YYYY-MM-DD format',
  })
  paymentDate: string;

  @ApiPropertyOptional({
    default: 'Liquidación anticipada. Interés del mes 3 condonado.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
