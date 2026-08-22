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

export class ClientListResponseDto extends ClientResponseDto {
  @ApiProperty({
    example: 2,
    description: 'Cantidad de préstamos activos del cliente.',
  })
  activeLoanCount: number;
}

export class LoanSummaryDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  id: string;

  @ApiProperty({ example: 'BOB', enum: ['BOB', 'USD'] })
  currency: string;

  @ApiProperty({ example: 'automatic', enum: ['automatic', 'manual'] })
  mode: string;

  @ApiProperty({ example: 1000.0 })
  capitalAmount: number;

  @ApiProperty({ example: 10 })
  interestRate: number;

  @ApiPropertyOptional({
    example: 'monthly',
    enum: ['daily', 'weekly', 'fortnightly', 'monthly', 'custom'],
  })
  periodType: string | null;

  @ApiProperty({ example: 6 })
  totalInstallments: number;

  @ApiProperty({ example: 1300.0 })
  totalAmount: number;

  @ApiProperty({ example: 650.0 })
  totalPaid: number;

  @ApiProperty({ example: 650.0 })
  outstandingBalance: number;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'COMPLETED', 'DEFAULTED', 'REFINANCED'],
  })
  status: string;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  createdAt: Date;
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

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/demo/image/upload/v123456/Juan%20Perez/garantias/sample.webp',
  })
  imageUrl: string | null;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  createdAt: Date;
}

export class ClientProfileResponseDto {
  @ApiProperty({ type: ClientResponseDto })
  client: ClientResponseDto;

  @ApiProperty({ type: [LoanSummaryDto] })
  activeLoans: LoanSummaryDto[];

  @ApiProperty({ type: [LoanSummaryDto] })
  completedLoans: LoanSummaryDto[];

  @ApiProperty({ type: [GuaranteeDto] })
  guarantees: GuaranteeDto[];
}
