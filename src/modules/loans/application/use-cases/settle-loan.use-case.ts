import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import { Money } from '../../domain/value-objects/money.vo';
import { UnitOfWork } from '../ports/unit-of-work.port';

/**
 * Datos de entrada para liquidar anticipadamente un préstamo.
 */
export interface SettleLoanInput {
  loanId: string;
  amount: number; // Dinero físico real entregado por el cliente
  discount: number; // Interés futuro condonado (puede ser 0 si no hay descuento)
  method: 'cash' | 'transfer';
  paymentDate: string; // YYYY-MM-DD
  notes?: string;
}

/**
 * Detalle de cada cuota saldada durante la liquidación.
 */
export interface SettledInstallmentResult {
  installmentId: string;
  installmentNumber: number;
  amountApplied: number;
  discountApplied: number;
}

/**
 * Resultado del caso de uso — se mapea a la respuesta HTTP en el controller.
 */
export interface SettleLoanResult {
  paymentId: string;
  loanId: string;
  amount: number;
  discountAmount: number;
  method: string;
  paymentDate: string;
  notes: string | null;
  settledInstallments: SettledInstallmentResult[];
  loanStatus: string;
  outstandingBalance: number;
}

/**
 * Caso de uso: Liquidación anticipada de un préstamo con condonación de interés.
 *
 * Diferencia clave con RegisterPaymentUseCase:
 * - Este caso de uso acepta un `discount` (interés futuro condonado).
 * - El `amount + discount` DEBE igualar exactamente el `outstandingBalance`.
 * - El préstamo siempre pasa a `COMPLETED` al finalizar.
 * - `loan.totalAmount` permanece intacto (invariante crítico).
 * - `loan.totalPaid` solo incrementa con `amount` (dinero físico real).
 * - `discountAmount` se persiste en el registro `Payment` para estadísticas.
 *
 * Flujo:
 * 1. Validar ownership del préstamo (tenant isolation)
 * 2. Cargar el préstamo con todas sus cuotas pendientes (FIFO)
 * 3. Llamar a `loan.settleEarly(paymentAmount, discountAmount)` — valida reglas de dominio
 * 4. Distribuir `amount` en las cuotas con FIFO normal
 * 5. Distribuir `discount` en las cuotas restantes (marcarlas PAID)
 * 6. Persistir atomicamente en UnitOfWork:
 *    - Crear Payment con discountAmount
 *    - Actualizar cuotas afectadas
 *    - Actualizar préstamo (status=COMPLETED, outstandingBalance=0)
 */
@Injectable()
export class SettleLoanUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    userId: string,
    input: SettleLoanInput,
  ): Promise<SettleLoanResult> {
    // 1. Validar ownership antes de abrir la transacción
    const loanExists = await this.prisma.loan.findFirst({
      where: {
        id: input.loanId,
        client: { userId, deletedAt: null },
      },
      select: { id: true },
    });

    if (!loanExists) {
      throw new NotFoundException('Loan not found');
    }

    // 2. Ejecutar en transacción atómica
    return this.unitOfWork.execute(async (repos) => {
      // 2a. Cargar préstamo con cuotas pendientes en orden FIFO
      const loan = await repos.loans.findByIdWithPendingInstallments(
        input.loanId,
      );

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      const paymentAmount = Money.of(input.amount, loan.currency);
      const discountAmount = Money.of(input.discount, loan.currency);

      // 2b. Validar y aplicar la liquidación en el dominio
      // Lanza: LoanNotActiveError, SettlementExceedsBalanceError, SettlementDoesNotClearBalanceError
      loan.settleEarly(paymentAmount, discountAmount);

      // 2c. Distribuir el monto físico (FIFO) en cuotas pendientes
      const settledInstallments: Array<{
        installment: InstallmentEntity;
        amountApplied: Money;
        discountApplied: Money;
      }> = [];

      let remainingPayment = paymentAmount;

      for (const installment of loan.installments) {
        if (remainingPayment.isZero()) break;

        const surplus = installment.applyPayment(remainingPayment);
        const applied = remainingPayment.subtract(surplus);

        if (!applied.isZero()) {
          settledInstallments.push({
            installment,
            amountApplied: applied,
            discountApplied: Money.of(0, loan.currency),
          });
        }

        remainingPayment = surplus;
      }

      // 2d. Distribuir el descuento (discount) en las cuotas que quedan pendientes
      //     Estas cuotas se marcan PAID gracias al descuento/condonación
      let remainingDiscount = discountAmount;

      for (const installment of loan.installments) {
        if (remainingDiscount.isZero()) break;
        if (installment.isPaid) continue;

        const surplus = installment.applyPayment(remainingDiscount);
        const discountApplied = remainingDiscount.subtract(surplus);

        if (!discountApplied.isZero()) {
          // Verificar si ya está registrada en settledInstallments (pago parcial + descuento)
          const existing = settledInstallments.find(
            (s) => s.installment.id === installment.id,
          );

          if (existing) {
            existing.discountApplied = discountApplied;
          } else {
            settledInstallments.push({
              installment,
              amountApplied: Money.of(0, loan.currency),
              discountApplied,
            });
          }
        }

        remainingDiscount = surplus;
      }

      // 2e. Persistir en la transacción
      // Se incluyen TODOS los settledInstallments (amountApplied y/o discountApplied).
      // Antes se filtraban los de amountApplied=0, perdiendo el registro de cuotas
      // cubiertas solo por condonación — lo que causaba bugs en stats y en void.
      const installmentLinks = settledInstallments.map(
        ({ installment, amountApplied, discountApplied }) => ({
          installmentId: installment.id!,
          amountApplied: amountApplied.toString(),
          discountApplied: discountApplied.toString(),
        }),
      );

      const paymentId = await repos.payments.create({
        loanId: loan.id!,
        registeredBy: userId,
        amount: paymentAmount.toString(),
        discountAmount: discountAmount.toString(),
        paymentDate: new Date(input.paymentDate),
        method: input.method,
        notes: input.notes ?? null,
        installmentLinks,
      });

      // Actualizar todas las cuotas afectadas (pago + descuento)
      const allAffectedInstallments = settledInstallments.map(
        (s) => s.installment,
      );
      await repos.installments.updateMany(allAffectedInstallments);

      // Actualizar préstamo (status=COMPLETED, outstandingBalance=0, totalPaid actualizado)
      await repos.loans.update(loan);

      // 2f. Construir resultado
      return {
        paymentId,
        loanId: loan.id!,
        amount: paymentAmount.toNumber(),
        discountAmount: discountAmount.toNumber(),
        method: input.method,
        paymentDate: input.paymentDate,
        notes: input.notes ?? null,
        settledInstallments: settledInstallments.map(
          ({ installment, amountApplied, discountApplied }) => ({
            installmentId: installment.id!,
            installmentNumber: installment.installmentNumber,
            amountApplied: amountApplied.toNumber(),
            discountApplied: discountApplied.toNumber(),
          }),
        ),
        loanStatus: loan.status,
        outstandingBalance: loan.outstandingBalance.toNumber(),
      };
    });
  }
}
