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

export class RegisterPaymentDto {
  @ApiProperty({ default: 'e69c1048-18e4-4a41-bbfb-bfdf0d0b0101' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  loanId: string;

  @ApiProperty({ default: 500 })
  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  amount: number;

  @ApiProperty({ default: 'cash', enum: ['cash', 'transfer'] })
  @IsString()
  @IsIn(['cash', 'transfer'])
  method: 'cash' | 'transfer';

  @ApiProperty({ default: '2026-08-19' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'paymentDate must be in YYYY-MM-DD format',
  })
  paymentDate: string;

  @ApiPropertyOptional({ default: 'Pago parcial cuota del día' })
  @IsOptional()
  @IsString()
  notes?: string;
}
