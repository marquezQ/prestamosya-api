import { ApiProperty } from '@nestjs/swagger';

// ─── Value objects reutilizables ─────────────────────────────────────────────

export class CurrencyAmountDto {
  @ApiProperty({ example: 1500.0, description: 'Monto en Bolivianos (BOB)' })
  BOB: number;

  @ApiProperty({ example: 215.75, description: 'Monto en Dólares (USD)' })
  USD: number;
}

// ─── Sección 1: Período ───────────────────────────────────────────────────────

export class PeriodDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 9, description: 'Mes del período (1-12)' })
  month: number;

  @ApiProperty({ example: 'Septiembre 2026' })
  label: string;

  @ApiProperty({ example: '2026-09-01' })
  startDate: string;

  @ApiProperty({ example: '2026-09-30' })
  endDate: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el período consultado es el mes en curso',
  })
  isCurrentMonth: boolean;
}

// ─── Sección 2: Ingresos del mes ─────────────────────────────────────────────

export class IncomeBreakdownDto {
  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Interés total efectivamente cobrado en el mes (ganancia real del prestamista)',
  })
  interestCollected: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Capital amortizado recuperado en el mes (dinero que vuelve al bolsillo, no es ganancia)',
  })
  capitalRecovered: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Total de efectivo recibido: interestCollected + capitalRecovered',
  })
  totalCashIn: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Interés condonado en liquidaciones anticipadas del mes (discount en payments/settle). No suma a la ganancia.',
  })
  discountsGiven: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description: 'Descuento o pérdida directa de capital otorgada en el mes.',
  })
  capitalDiscounted: CurrencyAmountDto;
}

// ─── Sección 3: Rendimiento del mes ──────────────────────────────────────────

export class PerformanceSummaryDto {
  @ApiProperty({
    example: 12,
    description: 'Total de cuotas que vencían dentro del período consultado',
  })
  installmentsDueCount: number;

  @ApiProperty({
    example: 8,
    description:
      'Cuotas del período pagadas antes o en su fecha de vencimiento',
  })
  installmentsPaidOnTimeCount: number;

  @ApiProperty({
    example: 2,
    description:
      'Cuotas del período pagadas después de su fecha de vencimiento (con mora)',
  })
  installmentsPaidLateCount: number;

  @ApiProperty({
    example: 1,
    description:
      'Cuotas del período que vencieron y aún no han sido pagadas completamente',
  })
  installmentsStillOverdueCount: number;

  @ApiProperty({
    example: 1,
    description: 'Cuotas del período con pago parcial registrado',
  })
  installmentsPartialCount: number;

  @ApiProperty({
    example: 83.33,
    description:
      'Porcentaje de cuotas del período cobradas completamente: (pagadas / vencidas) × 100',
  })
  collectionRate: number;

  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Ingresos de interés esperados del período (suma de interestAmount de cuotas que vencían)',
  })
  expectedRevenue: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description: 'Ingresos de interés realmente cobrados en el período',
  })
  actualRevenue: CurrencyAmountDto;

  @ApiProperty({
    example: 75.0,
    description:
      'Eficiencia de cobro de interés: (actualRevenue / expectedRevenue) × 100. Puede superar 100% si se cobró mora de cuotas de períodos anteriores.',
  })
  revenueEfficiency: number;
}

// ─── Sección 4: Indicadores de riesgo ────────────────────────────────────────

export class RiskIndicatorsDto {
  @ApiProperty({
    example: 16.67,
    description:
      'Porcentaje de morosidad actual: (préstamos activos con mora / total activos) × 100',
  })
  delinquencyRate: number;

  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Capital en riesgo: suma de outstandingBalance de préstamos activos con al menos 1 cuota OVERDUE',
  })
  portfolioAtRisk: CurrencyAmountDto;

  @ApiProperty({
    example: 3,
    description: 'Cantidad de nuevos préstamos desembolsados en el período',
  })
  newLoansCount: number;

  @ApiProperty({
    type: CurrencyAmountDto,
    description: 'Capital total desembolsado en préstamos nuevos del período',
  })
  newLoansCapital: CurrencyAmountDto;

  @ApiProperty({
    example: 1,
    description:
      'Préstamos que pasaron a estado COMPLETED durante el período (saldados)',
  })
  completedLoansCount: number;

  @ApiProperty({
    example: 2,
    description: 'Nuevos clientes registrados durante el período',
  })
  newClientsCount: number;
}

// ─── Sección 5: Balance general del mes ──────────────────────────────────────

export class MonthlyBalanceDto {
  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Ganancia neta del período: interestCollected - capitalDiscounted. Nunca mezcla BOB y USD.',
  })
  netProfit: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Capital total actualmente en calle (outstandingBalance de todos los préstamos activos)',
  })
  capitalDeployed: CurrencyAmountDto;

  @ApiProperty({
    type: CurrencyAmountDto,
    description:
      'Retorno sobre capital: (netProfit / capitalDeployed) × 100, calculado por separado para BOB y USD',
  })
  returnOnCapital: CurrencyAmountDto;
}

// ─── Response principal ───────────────────────────────────────────────────────

export class MonthlyStatsResponseDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: IncomeBreakdownDto })
  incomeBreakdown: IncomeBreakdownDto;

  @ApiProperty({ type: PerformanceSummaryDto })
  performanceSummary: PerformanceSummaryDto;

  @ApiProperty({ type: RiskIndicatorsDto })
  riskIndicators: RiskIndicatorsDto;

  @ApiProperty({ type: MonthlyBalanceDto })
  monthlyBalance: MonthlyBalanceDto;

  @ApiProperty({
    example: '2026-09-07T22:00:00.000Z',
    description: 'Timestamp UTC de generación del reporte',
  })
  generatedAt: string;
}
