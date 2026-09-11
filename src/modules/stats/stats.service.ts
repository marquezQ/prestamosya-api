import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayLaPaz, getStartOfDay } from '../../common/utils/date.utils';
import {
  CurrencyAmountDto,
  IncomeBreakdownDto,
  MonthlyBalanceDto,
  MonthlyStatsResponseDto,
  PerformanceSummaryDto,
  RiskIndicatorsDto,
} from './dto/monthly-stats-response.dto';
import { MonthlyHistoryItemDto } from './dto/monthly-history-response.dto';

/**
 * Resultado interno de la división de un pago entre interés y capital.
 * No se expone en la API, solo se usa dentro del service.
 */
interface PaymentSplit {
  toInterest: number;
  toCapital: number;
}

/**
 * Acumulador de montos por moneda. Permite sumar BOB y USD por separado
 * sin riesgo de mezclarlos.
 */
interface ByCurrency {
  BOB: number;
  USD: number;
}

const ZERO_BY_CURRENCY: ByCurrency = { BOB: 0, USD: 0 };

/**
 * Nombres de meses en español para construir etiquetas del período.
 */
const MONTH_NAMES_ES = [
  '', // índice 0 vacío para indexar con 1-12
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_SHORT_ES = [
  '',
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── API Pública ────────────────────────────────────────────────────────────

  /**
   * Genera el reporte completo de estadísticas para un mes específico.
   */
  async getMonthlyStats(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthlyStatsResponseDto> {
    const { startOfMonth, endOfMonth } = this._getMonthBounds(year, month);
    const today = getTodayLaPaz();
    const isCurrentMonth = today >= startOfMonth && today < endOfMonth;

    const [incomeBreakdown, activePortfolio] = await Promise.all([
      this._computeIncomeBreakdown(userId, startOfMonth, endOfMonth),
      this._computeActivePortfolioMetrics(userId, today),
    ]);

    const [performanceSummary, riskIndicators] = await Promise.all([
      this._computePerformanceSummary(userId, startOfMonth, endOfMonth, today),
      this._computeRiskIndicators(
        userId,
        startOfMonth,
        endOfMonth,
        activePortfolio,
      ),
    ]);

    const monthlyBalance = this._computeMonthlyBalance(
      incomeBreakdown,
      activePortfolio.capitalDeployed,
    );

    const lastDayOfMonth = new Date(endOfMonth);
    lastDayOfMonth.setUTCDate(lastDayOfMonth.getUTCDate() - 1);

    return {
      period: {
        year,
        month,
        label: `${MONTH_NAMES_ES[month]} ${year}`,
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: lastDayOfMonth.toISOString().split('T')[0],
        isCurrentMonth,
      },
      incomeBreakdown,
      performanceSummary,
      riskIndicators,
      monthlyBalance,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Genera el historial resumido de los últimos N meses para gráficas.
   */
  async getMonthlyHistory(
    userId: string,
    months: number,
  ): Promise<MonthlyHistoryItemDto[]> {
    const today = getTodayLaPaz();
    const results: MonthlyHistoryItemDto[] = [];

    // Iterar desde el mes más antiguo (months - 1) hasta el mes actual (0)
    // para devolver el arreglo en orden cronológico (ideal para gráficas X-axis)
    for (let i = months - 1; i >= 0; i--) {
      const refDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
      );
      const year = refDate.getUTCFullYear();
      const month = refDate.getUTCMonth() + 1; // getUTCMonth() es 0-indexed

      const { startOfMonth, endOfMonth } = this._getMonthBounds(year, month);

      const [income, performance] = await Promise.all([
        this._computeIncomeBreakdown(userId, startOfMonth, endOfMonth),
        this._computePerformanceSummary(
          userId,
          startOfMonth,
          endOfMonth,
          today,
        ),
      ]);

      results.push({
        year,
        month,
        label: `${MONTH_SHORT_ES[month]} ${year}`,
        interestCollected: income.interestCollected,
        netProfit: {
          BOB: this._round(
            income.interestCollected.BOB - income.discountsGiven.BOB,
          ),
          USD: this._round(
            income.interestCollected.USD - income.discountsGiven.USD,
          ),
        },
        collectionRate: performance.collectionRate,
        newLoansCount: 0, // se rellena en la siguiente llamada
      });
    }

    // Completar newLoansCount para cada mes con una única query en batch
    await this._fillNewLoansCount(userId, results, today);

    // Retorna ordenado cronológicamente: [mes_más_antiguo, ..., mes_actual]
    return results;
  }

  // ─── Métodos privados de cómputo ────────────────────────────────────────────

  /**
   * Calcula los ingresos del mes: interés cobrado, capital recuperado,
   * total de efectivo y descuentos por condonaciones.
   *
   * Algoritmo de split interés/capital:
   *   Para cada pago del mes (voided=false), en orden cronológico,
   *   se determina cuánto de cada amountApplied fue a interés y cuánto a capital.
   *   La prioridad es: primero se cubre el interés, luego el capital.
   *
   * La base de `paidBefore` por cuota se inicializa con `installment.paidAmount`
   * (acumulado histórico en BD) menos todos los `amountApplied` del mes que ya
   * procesamos para esa cuota en el loop. Esto asegura que pagos de meses
   * anteriores ya reflejados en `paidAmount` no distorsionen el cálculo.
   */
  private async _computeIncomeBreakdown(
    userId: string,
    startOfMonth: Date,
    endOfMonth: Date,
  ): Promise<IncomeBreakdownDto> {
    // Traer todos los pagos no anulados del mes con sus links de cuotas.
    // Ordenados por paymentDate ASC para procesar en orden cronológico.
    const payments = await this.prisma.payment.findMany({
      where: {
        loan: { createdBy: userId },
        voided: false,
        paymentDate: { gte: startOfMonth, lt: endOfMonth },
      },
      select: {
        discountAmount: true,
        loan: { select: { currency: true } },
        installmentLinks: {
          select: {
            interestPaid: true,
            capitalPaid: true,
            interestDiscounted: true,
            capitalDiscounted: true,
          },
        },
      },
      orderBy: { paymentDate: 'asc' },
    });

    const interestCollected: ByCurrency = { BOB: 0, USD: 0 };
    const capitalRecovered: ByCurrency = { BOB: 0, USD: 0 };
    const discountsGiven: ByCurrency = { BOB: 0, USD: 0 };

    for (const payment of payments) {
      const currency = payment.loan.currency;

      if (payment.discountAmount) {
        discountsGiven[currency] = this._round(
          discountsGiven[currency] + Number(payment.discountAmount),
        );
      }

      for (const link of payment.installmentLinks) {
        const interestPaid = Number(link.interestPaid ?? 0);
        const capitalPaid = Number(link.capitalPaid ?? 0);

        interestCollected[currency] = this._round(
          interestCollected[currency] + interestPaid,
        );
        capitalRecovered[currency] = this._round(
          capitalRecovered[currency] + capitalPaid,
        );
      }
    }

    return {
      interestCollected,
      capitalRecovered,
      totalCashIn: {
        BOB: this._round(interestCollected.BOB + capitalRecovered.BOB),
        USD: this._round(interestCollected.USD + capitalRecovered.USD),
      },
      discountsGiven,
    };
  }

  /**
   * Calcula las métricas de rendimiento del mes:
   * cuotas vencidas, pagadas, en mora, tasas de cobro y eficiencia de ingreso.
   */
  private async _computePerformanceSummary(
    userId: string,
    startOfMonth: Date,
    endOfMonth: Date,
    today: Date,
  ): Promise<PerformanceSummaryDto> {
    // Cuotas que vencían en el mes (no archivadas)
    const dueInstallments = await this.prisma.installment.findMany({
      where: {
        archived: false,
        dueDate: { gte: startOfMonth, lt: endOfMonth },
        loan: { createdBy: userId, client: { deletedAt: null } },
      },
      select: {
        id: true,
        status: true,
        dueDate: true,
        interestAmount: true,
        paidAmount: true,
        totalAmount: true,
        loan: { select: { currency: true } },
        // Traer todos los links para: (1) sumar amountApplied → actualRevenue correcto
        // y (2) leer la fecha del primer pago → determinar paidOnTime vs paidLate.
        paymentLinks: {
          where: { payment: { voided: false } },
          select: {
            interestPaid: true,
            payment: { select: { paymentDate: true } },
          },
          orderBy: { payment: { paymentDate: 'asc' } },
        },
      },
    });

    const expectedRevenue: ByCurrency = { BOB: 0, USD: 0 };
    const actualRevenue: ByCurrency = { BOB: 0, USD: 0 };

    let paidOnTime = 0;
    let paidLate = 0;
    let stillOverdue = 0;
    let partial = 0;

    for (const inst of dueInstallments) {
      const currency = inst.loan.currency;
      const interestAmt = Number(inst.interestAmount);

      expectedRevenue[currency] = this._round(
        expectedRevenue[currency] + interestAmt,
      );

      // Interés realmente cobrado en efectivo para esta cuota
      const interestPaidForInstallment = inst.paymentLinks
        ? inst.paymentLinks.reduce(
            (sum, pl) => sum + Number(pl.interestPaid ?? 0),
            0,
          )
        : 0;

      actualRevenue[currency] = this._round(
        actualRevenue[currency] +
          Math.min(interestAmt, interestPaidForInstallment),
      );

      if (inst.status === 'PAID') {
        // Verificar si pagó a tiempo o tarde
        const firstPaymentDate =
          inst.paymentLinks[0]?.payment?.paymentDate ?? null;
        const dueDate = new Date(inst.dueDate);

        if (firstPaymentDate && firstPaymentDate <= dueDate) {
          paidOnTime++;
        } else {
          paidLate++;
        }
      } else if (inst.status === 'PARTIAL') {
        partial++;
        // Una cuota parcial del mes también puede estar en mora
        if (new Date(inst.dueDate) < today) {
          stillOverdue++;
        }
      } else if (
        inst.status === 'OVERDUE' ||
        (inst.status === 'PENDING' && new Date(inst.dueDate) < today)
      ) {
        stillOverdue++;
      }
    }

    const totalDue = dueInstallments.length;
    const totalPaid = paidOnTime + paidLate;

    const collectionRate =
      totalDue > 0 ? this._round((totalPaid / totalDue) * 100) : 0;

    const revenueEfficiencyBOB =
      expectedRevenue.BOB > 0
        ? this._round((actualRevenue.BOB / expectedRevenue.BOB) * 100)
        : 0;

    return {
      installmentsDueCount: totalDue,
      installmentsPaidOnTimeCount: paidOnTime,
      installmentsPaidLateCount: paidLate,
      installmentsStillOverdueCount: stillOverdue,
      installmentsPartialCount: partial,
      collectionRate,
      expectedRevenue,
      actualRevenue,
      // La eficiencia se reporta en BOB como referencia (ambas monedas podrían diferir)
      revenueEfficiency: revenueEfficiencyBOB,
    };
  }

  /**
   * Calcula los indicadores de riesgo del mes:
   * morosidad, capital en riesgo, nuevos préstamos, clientes.
   */
  private async _computeRiskIndicators(
    userId: string,
    startOfMonth: Date,
    endOfMonth: Date,
    activePortfolio: {
      portfolioAtRisk: ByCurrency;
      delinquencyRate: number;
    },
  ): Promise<RiskIndicatorsDto> {
    const [newLoans, completedLoansCount, newClientsCount] = await Promise.all([
      // Préstamos nuevos desembolsados en el mes
      this.prisma.loan.findMany({
        where: {
          createdBy: userId,
          startDate: { gte: startOfMonth, lt: endOfMonth },
          client: { deletedAt: null },
        },
        select: { capitalAmount: true, currency: true },
      }),
      // Préstamos saldados en el mes
      this.prisma.loan.count({
        where: {
          createdBy: userId,
          status: 'COMPLETED',
          updatedAt: { gte: startOfMonth, lt: endOfMonth },
          client: { deletedAt: null },
        },
      }),
      // Nuevos clientes del mes
      this.prisma.client.count({
        where: {
          userId,
          deletedAt: null,
          createdAt: { gte: startOfMonth, lt: endOfMonth },
        },
      }),
    ]);

    // Agrupar capital de nuevos préstamos por moneda
    const newLoansCapital: ByCurrency = { BOB: 0, USD: 0 };
    for (const loan of newLoans) {
      const currency = loan.currency;
      newLoansCapital[currency] = this._round(
        newLoansCapital[currency] + Number(loan.capitalAmount),
      );
    }

    return {
      delinquencyRate: activePortfolio.delinquencyRate,
      portfolioAtRisk: activePortfolio.portfolioAtRisk,
      newLoansCount: newLoans.length,
      newLoansCapital,
      completedLoansCount,
      newClientsCount,
    };
  }

  /**
   * Obtiene la foto actual de la cartera activa:
   * Capital en calle (capitalDeployed) y Capital en riesgo (portfolioAtRisk).
   * Basado estrictamente en amortización de capital puro pendiente (igual que Home Dashboard).
   */
  private async _computeActivePortfolioMetrics(userId: string, today: Date) {
    const activeLoans = await this.prisma.loan.findMany({
      where: {
        createdBy: userId,
        status: 'ACTIVE',
        client: { deletedAt: null },
      },
      select: {
        id: true,
        currency: true,
        installments: {
          where: { archived: false },
          select: {
            dueDate: true,
            interestAmount: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
          },
        },
      },
    });

    const capitalDeployed: ByCurrency = { BOB: 0, USD: 0 };
    const portfolioAtRisk: ByCurrency = { BOB: 0, USD: 0 };
    let delinquentCount = 0;

    for (const loan of activeLoans) {
      const currency = loan.currency;
      let loanIsDelinquent = false;
      let loanRemainingCapital = 0;

      for (const inst of loan.installments) {
        if (inst.status !== 'PAID') {
          const totalAmt = Number(inst.totalAmount);
          const interestAmt = Number(inst.interestAmount);
          const paidAmt = Number(inst.paidAmount);

          const remainingInterest = Math.max(0, interestAmt - paidAmt);
          const remainingCapital = Math.max(
            0,
            totalAmt - paidAmt - remainingInterest,
          );

          loanRemainingCapital += remainingCapital;

          const instDueDate = getStartOfDay(new Date(inst.dueDate));
          if (inst.status === 'OVERDUE' || instDueDate < today) {
            loanIsDelinquent = true;
          }
        }
      }

      const roundedLoanCapital = this._round(loanRemainingCapital);
      capitalDeployed[currency] = this._round(
        capitalDeployed[currency] + roundedLoanCapital,
      );

      if (loanIsDelinquent) {
        delinquentCount++;
        portfolioAtRisk[currency] = this._round(
          portfolioAtRisk[currency] + roundedLoanCapital,
        );
      }
    }

    const totalActive = activeLoans.length;
    const delinquencyRate =
      totalActive > 0 ? this._round((delinquentCount / totalActive) * 100) : 0;

    return {
      capitalDeployed,
      portfolioAtRisk,
      delinquentCount,
      totalActive,
      delinquencyRate,
    };
  }

  /**
   * Calcula el balance general del prestamista para el mes consultado:
   * ganancia neta, capital desplegado y retorno sobre capital.
   */
  private _computeMonthlyBalance(
    income: IncomeBreakdownDto,
    capitalDeployed: ByCurrency,
  ): MonthlyBalanceDto {
    const netProfit: ByCurrency = {
      BOB: this._round(
        income.interestCollected.BOB - income.discountsGiven.BOB,
      ),
      USD: this._round(
        income.interestCollected.USD - income.discountsGiven.USD,
      ),
    };

    const returnOnCapital: ByCurrency = {
      BOB:
        capitalDeployed.BOB > 0
          ? this._round((netProfit.BOB / capitalDeployed.BOB) * 100)
          : 0,
      USD:
        capitalDeployed.USD > 0
          ? this._round((netProfit.USD / capitalDeployed.USD) * 100)
          : 0,
    };

    return { netProfit, capitalDeployed, returnOnCapital };
  }

  // ─── Utilidades puras (sin efectos secundarios, fáciles de testear) ──────────

  /**
   * Divide un pago entre interés y capital usando la regla de priorización:
   * primero se cubre el interés pendiente, luego el capital.
   *
   * @param amountApplied - Monto del pago aplicado a esta cuota
   * @param interestAmount - Interés total de la cuota según el cronograma
   * @param paidBefore - Monto ya pagado a esta cuota ANTES de este pago
   * @returns split con toInterest y toCapital, ambos >= 0
   */
  splitPayment(
    amountApplied: number,
    interestAmount: number,
    paidBefore: number,
  ): PaymentSplit {
    const interestYetToCover = Math.max(0, interestAmount - paidBefore);
    const toInterest = Math.min(amountApplied, interestYetToCover);
    const toCapital = amountApplied - toInterest;

    return {
      toInterest: this._round(toInterest),
      toCapital: this._round(toCapital),
    };
  }

  /**
   * Alias privado para uso interno del service.
   */
  private _splitPayment(
    amountApplied: number,
    interestAmount: number,
    paidBefore: number,
  ): PaymentSplit {
    return this.splitPayment(amountApplied, interestAmount, paidBefore);
  }

  /**
   * Calcula los límites de un mes dado como objetos Date UTC.
   * startOfMonth es el primer día del mes a las 00:00:00 UTC.
   * endOfMonth es el primer día del mes siguiente (límite exclusivo).
   */
  getMonthBounds(
    year: number,
    month: number,
  ): { startOfMonth: Date; endOfMonth: Date } {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 1));
    return { startOfMonth, endOfMonth };
  }

  private _getMonthBounds(
    year: number,
    month: number,
  ): { startOfMonth: Date; endOfMonth: Date } {
    return this.getMonthBounds(year, month);
  }

  /**
   * Redondea un número a 2 decimales (ROUND_HALF).
   */
  private _round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Rellena el campo `newLoansCount` en los ítems del historial con una
   * única query en batch para evitar N+1.
   */
  private async _fillNewLoansCount(
    userId: string,
    items: MonthlyHistoryItemDto[],
    today: Date,
  ): Promise<void> {
    if (items.length === 0) return;

    // Determinar el rango global (primer día del mes más antiguo → hoy+1)
    const oldest = items[0];
    const globalStart = new Date(Date.UTC(oldest.year, oldest.month - 1, 1));
    const globalEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
    );

    const loans = await this.prisma.loan.findMany({
      where: {
        createdBy: userId,
        startDate: { gte: globalStart, lt: globalEnd },
        client: { deletedAt: null },
      },
      select: { startDate: true },
    });

    // Agrupar por año-mes
    const countMap = new Map<string, number>();
    for (const loan of loans) {
      const d = new Date(loan.startDate);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    for (const item of items) {
      item.newLoansCount = countMap.get(`${item.year}-${item.month}`) ?? 0;
    }
  }

  /**
   * Construye un `CurrencyAmountDto` con ceros. Útil como valor inicial
   * cuando no hay datos para el período.
   */
  zeroCurrencyAmount(): CurrencyAmountDto {
    return { ...ZERO_BY_CURRENCY };
  }
}
