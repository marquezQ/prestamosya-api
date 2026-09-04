import { ApiProperty } from '@nestjs/swagger';

export class CapitalEnCalleDto {
  @ApiProperty({
    example: 15500.0,
    description: 'Capital en calle en Bolivianos (BOB)',
  })
  BOB: number;

  @ApiProperty({
    example: 1200.0,
    description: 'Capital en calle en Dólares (USD)',
  })
  USD: number;
}

export class LoansSummaryDto {
  @ApiProperty({
    example: 12,
    description: 'Total de préstamos activos en curso',
  })
  totalActive: number;

  @ApiProperty({
    example: 9,
    description: 'Total de préstamos activos sin cuotas vencidas',
  })
  totalUpToDate: number;

  @ApiProperty({
    example: 3,
    description: 'Total de préstamos activos con cuotas vencidas (en mora)',
  })
  totalDelinquent: number;

  @ApiProperty({
    example: 25.0,
    description: 'Porcentaje de morosidad (delinquent / totalActive * 100)',
  })
  delinquencyRate: number;
}

export class ClientsSummaryDto {
  @ApiProperty({
    example: 15,
    description: 'Total de clientes registrados del usuario',
  })
  totalClients: number;

  @ApiProperty({ example: 9, description: 'Clientes al día (sin mora)' })
  currentClients: number;

  @ApiProperty({ example: 3, description: 'Clientes con cuotas en mora' })
  delinquentClients: number;

  @ApiProperty({
    example: 3,
    description: 'Clientes registrados sin préstamo activo',
  })
  noLoanClients: number;
}

export class OverdueClientInfoDto {
  @ApiProperty({ example: 'uuid-cliente-1' })
  id: string;

  @ApiProperty({ example: 'Carlos Mendoza' })
  fullName: string;

  @ApiProperty({ example: 'Carlos' })
  firstName: string;

  @ApiProperty({ example: 'Mendoza' })
  lastName: string;

  @ApiProperty({ example: '+59171234567' })
  phone: string;
}

export class OverdueInstallmentItemDto {
  @ApiProperty({ example: 'uuid-cuota-1' })
  installmentId: string;

  @ApiProperty({ example: 'uuid-prestamo-1' })
  loanId: string;

  @ApiProperty({ example: 3, description: 'Número de cuota' })
  installmentNumber: number;

  @ApiProperty({ example: 'BOB', enum: ['BOB', 'USD'] })
  currency: string;

  @ApiProperty({ type: OverdueClientInfoDto })
  client: OverdueClientInfoDto;

  @ApiProperty({
    example: '2026-08-25T00:00:00.000Z',
    description: 'Fecha de vencimiento de la cuota',
  })
  dueDate: string;

  @ApiProperty({
    example: 9,
    description: 'Días transcurridos desde el vencimiento',
  })
  daysOverdue: number;

  @ApiProperty({
    example: 500.0,
    description: 'Monto total pactado para esta cuota',
  })
  expectedAmount: number;

  @ApiProperty({
    example: 100.0,
    description: 'Monto ya pagado para esta cuota',
  })
  paidAmount: number;

  @ApiProperty({
    example: 400.0,
    description: 'Monto pendiente por pagar en esta cuota',
  })
  pendingAmount: number;
}

export class HomeDashboardResponseDto {
  @ApiProperty({ type: CapitalEnCalleDto })
  capitalEnCalle: CapitalEnCalleDto;

  @ApiProperty({ type: LoansSummaryDto })
  loansSummary: LoansSummaryDto;

  @ApiProperty({ type: ClientsSummaryDto })
  clientsSummary: ClientsSummaryDto;

  @ApiProperty({ type: [OverdueInstallmentItemDto] })
  overdueInstallments: OverdueInstallmentItemDto[];

  @ApiProperty({ example: '2026-09-03T22:18:00.000Z' })
  generatedAt: string;
}
