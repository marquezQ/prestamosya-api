import { ApiProperty } from '@nestjs/swagger';
import {
  InstallmentStatus,
  LoanMode,
  LoanStatus,
  PeriodType,
} from '../domain/enums';
import { Currency } from '../domain/value-objects/money.vo';

export class InstallmentResponseDto {
  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  id: string | null;

  @ApiProperty({ example: 1 })
  installmentNumber: number;

  @ApiProperty({ example: '2026-09-15' })
  dueDate: string;

  @ApiProperty({ example: '333.33' })
  capitalAmount: string;

  @ApiProperty({ example: '100.00' })
  interestAmount: string;

  @ApiProperty({ example: '433.33' })
  totalAmount: string;

  @ApiProperty({ example: '0.00' })
  paidAmount: string;

  @ApiProperty({ example: '433.33' })
  remainingAmount: string;

  @ApiProperty({ enum: InstallmentStatus, example: InstallmentStatus.PENDING })
  status: InstallmentStatus;

  @ApiProperty({ example: 0 })
  daysOverdue: number;

  @ApiProperty({ example: null, nullable: true })
  paidAt: string | null;

  @ApiProperty({ example: false })
  archived: boolean;
}

export class LoanResponseDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string | null;

  @ApiProperty({ example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
  clientId: string;

  @ApiProperty({ example: 'u1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' })
  createdBy: string;

  @ApiProperty({ enum: LoanMode, example: LoanMode.AUTOMATIC })
  mode: LoanMode;

  @ApiProperty({ example: '1000.00' })
  capitalAmount: string;

  @ApiProperty({ example: 'BOB' })
  currency: Currency;

  @ApiProperty({ example: 10 })
  interestRate: number;

  @ApiProperty({ enum: PeriodType, example: PeriodType.MONTHLY })
  periodType: PeriodType | null;

  @ApiProperty({ example: 3 })
  totalInstallments: number;

  @ApiProperty({ example: '1300.00' })
  totalAmount: string;

  @ApiProperty({ example: '0.00' })
  totalPaid: string;

  @ApiProperty({ example: '1300.00' })
  outstandingBalance: string;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.ACTIVE })
  status: LoanStatus;

  @ApiProperty({ example: '2026-08-15' })
  startDate: string;

  @ApiProperty({ example: '2026-09-15' })
  firstDueDate: string;

  @ApiProperty({ example: 'Préstamo personal para mercadería', nullable: true })
  notes: string | null;

  @ApiProperty({ type: [InstallmentResponseDto] })
  installments: InstallmentResponseDto[];
}
