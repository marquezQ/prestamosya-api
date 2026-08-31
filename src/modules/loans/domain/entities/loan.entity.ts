import Decimal from 'decimal.js';
import { LoanStatus, LoanMode, PeriodType, LoanScheduleType } from '../enums';
import {
  LoanNotActiveError,
  LoanNotRefinancableError,
  PaymentExceedsBalanceError,
  SettlementDoesNotClearBalanceError,
  SettlementExceedsBalanceError,
} from '../errors/loan-domain.errors';
import { Currency, Money } from '../value-objects/money.vo';
import { InstallmentEntity } from './installment.entity';

/**
 * Entidad raíz del dominio de préstamos.
 *
 * Responsabilidades:
 * - Encapsular las reglas de negocio del préstamo
 * - Validar operaciones (pagos, refinanciamiento)
 * - Mantener consistencia entre sus propiedades (saldo, estado)
 *
 * No conoce Prisma, NestJS, ni ninguna dependencia de infraestructura.
 * Todas las operaciones financieras usan el Value Object Money
 * para garantizar aritmética exacta y prevenir mezcla de monedas.
 */
export class LoanEntity {
  constructor(
    public readonly id: string | null,
    public readonly clientId: string,
    public readonly createdBy: string,
    public readonly mode: LoanMode,
    public readonly capitalAmount: Money,
    public readonly interestRate: Decimal,
    public readonly periodType: PeriodType | null,
    public readonly totalInstallments: number,
    public readonly totalAmount: Money,
    public totalPaid: Money,
    public outstandingBalance: Money,
    public status: LoanStatus,
    public readonly startDate: Date,
    public readonly firstDueDate: Date,
    public readonly notes: string | null,
    public installments: InstallmentEntity[],
    public readonly scheduleType: LoanScheduleType = LoanScheduleType.EQUAL_INSTALLMENTS,
  ) {}

  /** Moneda del préstamo, delegada al capitalAmount. */
  get currency(): Currency {
    return this.capitalAmount.currency;
  }

  get isActive(): boolean {
    return this.status === LoanStatus.ACTIVE;
  }

  get isCompleted(): boolean {
    return this.status === LoanStatus.COMPLETED;
  }

  /**
   * Un préstamo es refinanciable si está activo y tiene saldo pendiente.
   * No se puede refinanciar un préstamo ya completado, defaulted o refinanciado.
   */
  canBeRefinanced(): boolean {
    return this.isActive && !this.outstandingBalance.isZero();
  }

  /**
   * Un préstamo puede recibir pagos si está activo.
   * No se aceptan pagos en préstamos completados, defaulted o refinanciados.
   */
  canReceivePayment(): boolean {
    return this.isActive;
  }

  /**
   * Aplica un pago al préstamo, actualizando saldo pendiente y total pagado.
   *
   * @throws PaymentExceedsBalanceError si el monto supera el saldo pendiente
   * @throws LoanNotActiveError si el préstamo no está activo
   */
  applyPayment(amount: Money): void {
    if (!this.canReceivePayment()) {
      throw new LoanNotActiveError(this.id ?? 'new', this.status);
    }

    if (amount.isGreaterThan(this.outstandingBalance)) {
      throw new PaymentExceedsBalanceError(
        amount.toString(),
        this.outstandingBalance.toString(),
      );
    }

    this.outstandingBalance = this.outstandingBalance.subtract(amount);
    this.totalPaid = this.totalPaid.add(amount);

    if (this.outstandingBalance.isZero()) {
      this.status = LoanStatus.COMPLETED;
    }
  }

  /**
   * Liquida anticipadamente el préstamo aplicando un pago real más un descuento
   * de interés futuro condonado por el prestamista.
   *
   * INVARIANTE CRÍTICO: `totalAmount` NUNCA se modifica. Es el contrato
   * original del préstamo y debe permanecer intacto para las estadísticas
   * históricas (ganancia proyectada vs. ganancia real).
   *
   * El `discountAmount` se persiste en el registro `Payment` como columna
   * separada, permitiendo que los reportes distingan:
   *   - Ganancia real = totalPaid - capitalAmount
   *   - Interés condonado = sum(payments.discountAmount)
   *
   * @param paymentAmount - Dinero físico entregado por el cliente
   * @param discountAmount - Interés futuro condonado por el prestamista
   * @throws LoanNotActiveError si el préstamo no está activo
   * @throws SettlementExceedsBalanceError si amount + discount supera el saldo
   * @throws SettlementDoesNotClearBalanceError si amount + discount no liquida el saldo completo
   */
  settleEarly(paymentAmount: Money, discountAmount: Money): void {
    if (!this.canReceivePayment()) {
      throw new LoanNotActiveError(this.id ?? 'new', this.status);
    }

    const totalSettlement = paymentAmount.add(discountAmount);

    if (totalSettlement.isGreaterThan(this.outstandingBalance)) {
      throw new SettlementExceedsBalanceError(
        totalSettlement.toString(),
        this.outstandingBalance.toString(),
      );
    }

    if (!totalSettlement.equals(this.outstandingBalance)) {
      throw new SettlementDoesNotClearBalanceError(
        totalSettlement.toString(),
        this.outstandingBalance.toString(),
      );
    }

    this.outstandingBalance = this.outstandingBalance.subtract(totalSettlement);
    this.totalPaid = this.totalPaid.add(paymentAmount); // Solo dinero físico real
    this.status = LoanStatus.COMPLETED; // Garantizado: outstandingBalance == 0
  }

  /**
   * Revierte un pago, restaurando saldo pendiente y total pagado.
   * Usado al anular un pago (voided=true).
   *
   * Si el préstamo estaba COMPLETED y se revierte un pago,
   * vuelve a estado ACTIVE.
   */
  revertPayment(amount: Money): void {
    this.outstandingBalance = this.outstandingBalance.add(amount);
    this.totalPaid = this.totalPaid.subtract(amount);

    if (this.isCompleted) {
      this.status = LoanStatus.ACTIVE;
    }
  }

  /**
   * Marca el préstamo como refinanciado.
   *
   * @throws LoanNotRefinancableError si no se puede refinanciar
   */
  markAsRefinanced(): void {
    if (!this.canBeRefinanced()) {
      throw new LoanNotRefinancableError(
        this.id ?? 'new',
        this.isActive
          ? 'outstanding balance is zero'
          : `loan status is ${this.status}`,
      );
    }

    this.status = LoanStatus.REFINANCED;
  }

  /**
   * Retorna las cuotas activas (no archivadas) ordenadas por número.
   */
  get activeInstallments(): InstallmentEntity[] {
    return this.installments
      .filter((i) => !i.isArchived)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);
  }
}
