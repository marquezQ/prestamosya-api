import Decimal from 'decimal.js';
import { InstallmentStatus, PeriodType } from '../enums';
import { InstallmentEntity } from '../entities/installment.entity';
import { Money } from '../value-objects/money.vo';

/**
 * Parámetros de entrada para el cálculo de cuotas en modo automático.
 *
 * `startDate` es la fecha de desembolso del préstamo.
 * La fecha de vencimiento de la primera cuota se calcula
 * automáticamente como `startDate + 1 período`.
 */
export interface CalculateInstallmentsParams {
  capital: Money;
  interestRate: Decimal;
  totalInstallments: number;
  startDate: Date;
  periodType: PeriodType;
}

/**
 * Resultado del cálculo de cuotas.
 */
export interface CalculateInstallmentsResult {
  installments: InstallmentEntity[];
  totalAmount: Money;
}

/**
 * Servicio de dominio para cálculos financieros de préstamos.
 *
 * TypeScript puro — sin NestJS, sin Prisma, sin efectos secundarios.
 *
 * Fórmula de préstamo automático (Flat / Interés simple sobre capital):
 *   1. interés total = capital × (tasa / 100) × cantidad_de_cuotas
 *   2. total del préstamo = capital + interés total
 *   3. cuota base = total del préstamo / cantidad_de_cuotas
 *
 * Desglose por cuota:
 *   - interés por cuota = interés total / cantidad_de_cuotas
 *   - capital por cuota = cuota base - interés por cuota
 *
 * Regla de redondeo:
 *   Cada cuota se redondea a 2 decimales (ROUND_HALF_UP).
 *   La última cuota absorbe cualquier diferencia de redondeo para que:
 *     sum(cuotas.totalAmount) === totalAmount
 *     sum(cuotas.capitalAmount) === capital
 *     sum(cuotas.interestAmount) === totalInterest
 */
export class LoanCalculatorService {
  /**
   * Calcula las cuotas para un préstamo en modo automático.
   */
  calculateInstallments(
    params: CalculateInstallmentsParams,
  ): CalculateInstallmentsResult {
    const { capital, interestRate, totalInstallments, startDate, periodType } =
      params;

    const firstDueDate = this.calculateDueDate(startDate, periodType, 1);
    const currency = capital.currency;

    // Tasa por período como decimal: 10% -> 0.10
    const ratePerPeriod = interestRate.dividedBy(100);

    // 1. Interés total = capital × tasa × n_cuotas
    const totalInterestRaw = capital.amount
      .mul(ratePerPeriod)
      .mul(totalInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const totalInterest = Money.of(totalInterestRaw, currency);

    // 2. Total del préstamo = capital + interés total
    const totalAmount = capital.add(totalInterest);

    // 3. Cuota regular base = total del préstamo / n_cuotas
    const regularInstallmentTotalRaw = totalAmount.amount
      .dividedBy(totalInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Interés base por cuota = interés total / n_cuotas
    const regularInterestRaw = totalInterest.amount
      .dividedBy(totalInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Capital base por cuota = cuota total - interés por cuota
    const regularCapitalRaw =
      regularInstallmentTotalRaw.minus(regularInterestRaw);

    const installments: InstallmentEntity[] = [];
    let accumulatedCapital = new Decimal(0);
    let accumulatedInterest = new Decimal(0);
    let accumulatedTotal = new Decimal(0);

    for (let i = 1; i <= totalInstallments; i++) {
      const dueDate = this.calculateDueDate(firstDueDate, periodType, i - 1);
      const isLast = i === totalInstallments;

      let installmentCapital: Decimal;
      let installmentInterest: Decimal;
      let installmentTotal: Decimal;

      if (isLast) {
        // La última cuota absorbe cualquier diferencia de redondeo acumulada
        installmentCapital = capital.amount.minus(accumulatedCapital);
        installmentInterest = totalInterest.amount.minus(accumulatedInterest);
        installmentTotal = totalAmount.amount.minus(accumulatedTotal);
      } else {
        installmentCapital = regularCapitalRaw;
        installmentInterest = regularInterestRaw;
        installmentTotal = regularInstallmentAmountTotalRaw(
          regularInstallmentTotalRaw,
        );
      }

      installments.push(
        new InstallmentEntity(
          null, // id: se asigna al persistir
          null, // loanId: se asigna al persistir
          i,
          dueDate,
          Money.of(installmentCapital, currency),
          Money.of(installmentInterest, currency),
          Money.of(installmentTotal, currency),
          Money.zero(currency), // paidAmount
          InstallmentStatus.PENDING,
          0, // daysOverdue
          null, // paidAt
          false, // archived
        ),
      );

      accumulatedCapital = accumulatedCapital.plus(installmentCapital);
      accumulatedInterest = accumulatedInterest.plus(installmentInterest);
      accumulatedTotal = accumulatedTotal.plus(installmentTotal);
    }

    return { installments, totalAmount };
  }

  /**
   * Calcula la fecha de vencimiento para una cuota según el tipo de período.
   * Utiliza métodos UTC para evitar desfases por zona horaria.
   */
  calculateDueDate(
    firstDueDate: Date,
    periodType: PeriodType,
    offset: number,
  ): Date {
    const date = new Date(firstDueDate.getTime());

    switch (periodType) {
      case PeriodType.DAILY:
        date.setUTCDate(date.getUTCDate() + offset);
        break;
      case PeriodType.WEEKLY:
        date.setUTCDate(date.getUTCDate() + offset * 7);
        break;
      case PeriodType.FORTNIGHTLY:
        date.setUTCDate(date.getUTCDate() + offset * 15);
        break;
      case PeriodType.MONTHLY:
        date.setUTCMonth(date.getUTCMonth() + offset);
        break;
      case PeriodType.CUSTOM:
        break;
    }

    return date;
  }
}

function regularInstallmentAmountTotalRaw(val: Decimal): Decimal {
  return val;
}
