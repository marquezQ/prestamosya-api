import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PeriodType } from '../domain/enums';
import { Currency } from '../domain/value-objects/money.vo';

export class SimulateLoanDto {
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

  @ApiProperty({ enum: PeriodType, default: PeriodType.MONTHLY })
  @IsEnum(PeriodType)
  periodType: PeriodType;

  @ApiProperty({
    default: 3,
    description: 'Número total de cuotas. Debe ser un entero >= 1.',
  })
  @IsInt()
  @Min(1)
  @Max(360)
  totalInstallments: number;

  @ApiProperty({
    default: '2026-09-15',
    description: 'Fecha de vencimiento de la primera cuota (YYYY-MM-DD)',
  })
  @IsDateString()
  firstDueDate: string;
}
