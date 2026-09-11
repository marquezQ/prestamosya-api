import { InstallmentStatus } from '../enums';
import { Money } from '../value-objects/money.vo';

/**
 * Entidad de dominio que representa una cuota de un préstamo.
 *
 * Responsabilidades:
 * - Aplicar/revertir pagos parciales o completos
 * - Calcular el monto restante por pagar
 * - Determinar su propio estado (PENDING/PARTIAL/PAID) basado en paidAmount
 *
 * Nota: el estado OVERDUE lo asigna el cron de mora externamente,
 * no la lógica interna de esta entidad.
 */
export class InstallmentEntity {
  constructor(
    public readonly id: string | null,
    public readonly loanId: string | null,
    public readonly installmentNumber: number,
    public readonly dueDate: Date,
    public readonly capitalAmount: Money,
    public readonly interestAmount: Money,
    public readonly totalAmount: Money,
    public paidAmount: Money,
    public status: InstallmentStatus,
    public daysOverdue: number,
    public paidAt: Date | null,
    public archived: boolean,
  ) {}

  /** Monto pendiente de pago para esta cuota. */
  get remainingAmount(): Money {
    return this.totalAmount.subtract(this.paidAmount);
  }

  get isPaid(): boolean {
    return this.status === InstallmentStatus.PAID;
  }

  get isArchived(): boolean {
    return this.archived;
  }

  /**
   * Aplica un pago a esta cuota.
   *
   * Si el monto del pago es mayor que lo que queda por pagar,
   * se aplica solo lo necesario y se retorna el sobrante.
   * Si es menor o igual, se aplica todo y se retorna Money.zero().
   *
   * @param amount - Monto a aplicar (misma moneda que la cuota)
   * @returns Sobrante que no se pudo aplicar a esta cuota
   */
  applyPayment(amount: Money): Money {
    if (this.isPaid || this.isArchived) {
      return amount; // Nada que aplicar, retornar todo como sobrante
    }

    const remaining = this.remainingAmount;
    const applicable = amount.isGreaterThan(remaining) ? remaining : amount;

    this.paidAmount = this.paidAmount.add(applicable);
    this.recalculateStatus();

    if (this.isPaid) {
      this.paidAt = new Date();
    }

    return amount.subtract(applicable);
  }

  /**
   * Aplica un pago a esta cuota desglosando explícitamente cuánto se destina a interés y a capital.
   * Regla bancaria comercial: primero se cubre el interés pendiente, luego el capital.
   */
  applyPaymentDetailed(amount: Money): {
    surplus: Money;
    interestPaid: Money;
    capitalPaid: Money;
  } {
    const zero = Money.zero(this.totalAmount.currency);
    if (this.isPaid || this.isArchived || amount.isZero()) {
      return { surplus: amount, interestPaid: zero, capitalPaid: zero };
    }

    const currentPaid = this.paidAmount;
    const interestPaidBefore = currentPaid.isGreaterThan(this.interestAmount)
      ? this.interestAmount
      : currentPaid;
    const interestUnpaid = this.interestAmount.subtract(interestPaidBefore);

    // 1. Cubrir interés pendiente primero
    const interestPaid = amount.isGreaterThan(interestUnpaid)
      ? interestUnpaid
      : amount;
    let remaining = amount.subtract(interestPaid);

    // 2. Cubrir capital pendiente después
    const capitalPaidBefore = currentPaid.isGreaterThan(this.interestAmount)
      ? currentPaid.subtract(this.interestAmount)
      : zero;
    const capitalUnpaid = this.capitalAmount.isGreaterThan(capitalPaidBefore)
      ? this.capitalAmount.subtract(capitalPaidBefore)
      : zero;

    const capitalPaid = remaining.isGreaterThan(capitalUnpaid)
      ? capitalUnpaid
      : remaining;
    remaining = remaining.subtract(capitalPaid);

    const totalApplied = interestPaid.add(capitalPaid);
    this.paidAmount = this.paidAmount.add(totalApplied);
    this.recalculateStatus();

    if (this.isPaid) {
      this.paidAt = new Date();
    }

    return {
      surplus: remaining,
      interestPaid,
      capitalPaid,
    };
  }

  /**
   * Revierte un pago previamente aplicado a esta cuota.
   *
   * @param amount - Monto a revertir (debe ser <= paidAmount)
   */
  revertPayment(amount: Money): void {
    this.paidAmount = this.paidAmount.subtract(amount);
    this.paidAt = null;
    this.recalculateStatus();
  }

  /** Marca la cuota como archivada (usado en refinanciamiento). */
  archive(): void {
    this.archived = true;
  }

  /**
   * Recalcula el estado de la cuota basado en paidAmount vs totalAmount.
   *
   * Reglas (de BUSINESS_RULES.md):
   * - paidAmount == 0 → PENDING (OVERDUE se asigna externamente por el cron)
   * - 0 < paidAmount < totalAmount → PARTIAL
   * - paidAmount >= totalAmount → PAID
   *
   * No modifica OVERDUE: ese estado es responsabilidad del cron de mora.
   * Si la cuota estaba OVERDUE y recibe un pago parcial, pasa a PARTIAL.
   * Si recibe pago completo, pasa a PAID.
   */
  recalculateStatus(): void {
    if (this.paidAmount.isGreaterThanOrEqual(this.totalAmount)) {
      this.status = InstallmentStatus.PAID;
    } else if (this.paidAmount.isZero()) {
      // Mantener OVERDUE si ya lo era, si no PENDING
      if (this.status !== InstallmentStatus.OVERDUE) {
        this.status = InstallmentStatus.PENDING;
      }
    } else {
      this.status = InstallmentStatus.PARTIAL;
    }
  }
}
