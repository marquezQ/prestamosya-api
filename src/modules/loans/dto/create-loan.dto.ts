import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LoanMode, PeriodType } from '../domain/enums';
import { Currency } from '../domain/value-objects/money.vo';

export class ManualInstallmentDto {
  @ApiProperty({ default: 1 })
  @IsNumber()
  installmentNumber: number;

  @ApiProperty({ default: '2026-09-01' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ default: 333.33 })
  @IsNumber()
  @Min(0)
  capitalAmount: number;

  @ApiProperty({ default: 100.0 })
  @IsNumber()
  @Min(0)
  interestAmount: number;

  @ApiProperty({ default: 433.33 })
  @IsNumber()
  @Min(0)
  totalAmount: number;
}

export class CreateLoanDto {
  @ApiProperty({
    default: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'ID del cliente prestatario',
  })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    enum: LoanMode,
    default: LoanMode.AUTOMATIC,
    description: 'Modo de préstamo: automatic o manual',
  })
  @IsEnum(LoanMode)
  mode: LoanMode;

  @ApiProperty({
    default: 1000,
    description: 'Monto del capital prestado en la moneda indicada',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999.99)
  capitalAmount: number;

  @ApiProperty({
    default: 'BOB',
    description: 'Moneda del préstamo',
    enum: ['BOB', 'USD'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['BOB', 'USD'])
  currency: Currency;

  @ApiProperty({
    default: 10,
    description: 'Tasa de interés por período (ej. 10 para 10%). Máximo 100.',
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  interestRate: number;

  @ApiPropertyOptional({ enum: PeriodType, default: PeriodType.MONTHLY })
  @IsOptional()
  @IsEnum(PeriodType)
  periodType?: PeriodType;

  @ApiProperty({
    default: 3,
    description: 'Número total de cuotas. Debe ser un entero >= 1.',
  })
  @IsInt()
  @Min(1)
  @Max(360)
  totalInstallments: number;

  @ApiProperty({
    default: '2026-08-15',
    description: 'Fecha de desembolso (YYYY-MM-DD)',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    default: '2026-09-15',
    description: 'Fecha de vencimiento de la primera cuota (YYYY-MM-DD)',
  })
  @IsDateString()
  firstDueDate: string;

  @ApiPropertyOptional({ default: 'Préstamo personal para mercadería' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [ManualInstallmentDto],
    description:
      'Cronograma manual de cuotas (requerido solo si mode es manual)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualInstallmentDto)
  manualInstallments?: ManualInstallmentDto[];
}
