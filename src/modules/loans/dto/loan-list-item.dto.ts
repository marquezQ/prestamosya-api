import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoanListItemClientDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'María Quispe Mamani' })
  fullName: string;

  @ApiProperty({ example: '5555555 LP' })
  idNumber: string;

  @ApiProperty({ example: '71234567' })
  phone: string;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/demo/image/upload/v123/photos/abc/clients/photo.webp',
    nullable: true,
  })
  photoUrl: string | null;
}

export class LoanListItemDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  id: string;

  @ApiProperty({ example: 'BOB', enum: ['BOB', 'USD'] })
  currency: string;

  @ApiProperty({ example: 'automatic', enum: ['automatic', 'manual'] })
  mode: string;

  @ApiProperty({
    example: 'EQUAL_INSTALLMENTS',
    enum: ['EQUAL_INSTALLMENTS', 'INTEREST_ONLY'],
  })
  scheduleType: string;

  @ApiProperty({ example: 1000.0 })
  capitalAmount: number;

  @ApiProperty({ example: 10 })
  interestRate: number;

  @ApiPropertyOptional({ example: 'monthly', nullable: true })
  periodType: string | null;

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

  @ApiProperty({ example: '2026-07-01' })
  startDate: string;

  @ApiPropertyOptional({ example: '2026-08-01', nullable: true })
  nextDueDate: string | null;

  @ApiProperty({
    example: true,
    description: 'True si el préstamo tiene al menos una cuota en mora',
  })
  isDelinquent: boolean;

  @ApiProperty({ example: 6 })
  totalInstallments: number;

  @ApiProperty({ example: 3 })
  paidInstallments: number;

  @ApiProperty({ example: 1 })
  overdueInstallmentsCount: number;

  @ApiProperty({ type: LoanListItemClientDto })
  client: LoanListItemClientDto;

  @ApiProperty({ example: '2026-07-01T12:00:00.000Z' })
  createdAt: Date;
}
