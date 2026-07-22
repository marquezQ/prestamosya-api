import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClientResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'María Quispe Mamani' })
  fullName: string;

  @ApiProperty({ example: '71234567' })
  phone: string;

  @ApiProperty({ example: '1234567 LP' })
  idNumber: string;

  @ApiPropertyOptional({ example: '70123456' })
  phoneAlt: string | null;

  @ApiPropertyOptional({ example: 'Av. Arce 123, La Paz' })
  address: string | null;

  @ApiPropertyOptional({ example: -16.5001 })
  latitude: number | null;

  @ApiPropertyOptional({ example: -68.1342 })
  longitude: number | null;

  @ApiProperty({
    example: 'CURRENT',
    enum: ['NO_LOAN', 'CURRENT', 'DELINQUENT'],
  })
  status: string;

  @ApiPropertyOptional({ example: 'Prefiere cobro por las mañanas.' })
  notes: string | null;

  @ApiProperty({ example: '2026-07-21T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-21T00:00:00.000Z' })
  updatedAt: Date;
}

export class NextInstallmentDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  id: string;

  @ApiProperty({ example: 3 })
  number: number;

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ example: 433.33 })
  pendingAmount: number;

  @ApiProperty({
    example: 'PENDING',
    enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'],
  })
  status: string;
}

export class ActiveLoanDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  id: string;

  @ApiProperty({ example: 'BOB', enum: ['BOB', 'USD'] })
  currency: string;

  @ApiProperty({ example: 1300.0 })
  totalAmount: number;

  @ApiProperty({ example: 433.34 })
  outstandingBalance: number;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  startDate: Date;

  @ApiPropertyOptional({ type: NextInstallmentDto })
  nextInstallment: NextInstallmentDto | null;
}

export class GuaranteeDto {
  @ApiProperty({ example: 'd4e5f6a7-b8c9-0123-defa-1234567890ab' })
  id: string;

  @ApiProperty({
    example: 'VEHICLE',
    enum: ['VEHICLE', 'REAL_ESTATE', 'FURNITURE', 'OTHER'],
  })
  type: string;

  @ApiProperty({ example: 'Toyota Corolla 2015' })
  description: string;

  @ApiPropertyOptional({ example: 15000 })
  estimatedValue: number | null;

  @ApiProperty({
    example: 'AVAILABLE',
    enum: ['AVAILABLE', 'IN_USE', 'RELEASED'],
  })
  status: string;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  createdAt: Date;
}

export class FinancialSummaryDto {
  @ApiProperty({ example: 'BOB' })
  currency: string;

  @ApiProperty({ example: 1250.0 })
  totalOwed: number;

  @ApiProperty({ example: 2 })
  overdueInstallments: number;

  @ApiProperty({ example: 433.33 })
  overdueAmount: number;
}

export class ClientProfileResponseDto {
  @ApiProperty({ type: ClientResponseDto })
  client: ClientResponseDto;

  @ApiProperty({ type: [ActiveLoanDto] })
  activeLoans: ActiveLoanDto[];

  @ApiProperty({ type: [GuaranteeDto] })
  guarantees: GuaranteeDto[];

  @ApiProperty({ type: [FinancialSummaryDto] })
  financialSummary: FinancialSummaryDto[];
}
