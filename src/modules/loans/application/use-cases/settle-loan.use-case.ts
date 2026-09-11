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

      // 2c. Mapa para acumular desgloses explícitos por cuota
      const settledMap = new Map<
        string,
        {
          installment: InstallmentEntity;
          interestPaid: Money;
          capitalPaid: Money;
          interestDiscounted: Money;
          capitalDiscounted: Money;
        }
      >();

      const zeroMoney = Money.of(0, loan.currency);

      const getOrCreateSettled = (inst: InstallmentEntity) => {
        let entry = settledMap.get(inst.id!);
        if (!entry) {
          entry = {
            installment: inst,
            interestPaid: zeroMoney,
            capitalPaid: zeroMoney,
            interestDiscounted: zeroMoney,
            capitalDiscounted: zeroMoney,
          };
          settledMap.set(inst.id!, entry);
        }
        return entry;
      };

      // 2d. Distribuir el descuento (discountAmount) PRIMERO sobre el interés no cubierto
      //     de las cuotas pendientes (condonación de interés futuro).
      let remainingDiscount = discountAmount;

      for (const installment of loan.installments) {
        if (remainingDiscount.isZero()) break;
        if (installment.isPaid) continue;

        const currentPaid = installment.paidAmount;
        const interestAmt = installment.interestAmount;
        const interestUnpaid = interestAmt.isGreaterThan(currentPaid)
          ? interestAmt.subtract(currentPaid)
          : zeroMoney;

        if (!interestUnpaid.isZero()) {
          const discountToApply = remainingDiscount.isGreaterThan(
            interestUnpaid,
          )
            ? interestUnpaid
            : remainingDiscount;

          const surplus = installment.applyPayment(discountToApply);
          const applied = discountToApply.subtract(surplus);

          if (!applied.isZero()) {
            const entry = getOrCreateSettled(installment);
            entry.interestDiscounted = entry.interestDiscounted.add(applied);
          }

          remainingDiscount = remainingDiscount.subtract(applied);
        }
      }

      // Si aún queda excedente de descuento, aplicarlo como descuento a capital
      for (const installment of loan.installments) {
        if (remainingDiscount.isZero()) break;
        if (installment.isPaid) continue;

        const surplus = installment.applyPayment(remainingDiscount);
        const applied = remainingDiscount.subtract(surplus);

        if (!applied.isZero()) {
          const entry = getOrCreateSettled(installment);
          entry.capitalDiscounted = entry.capitalDiscounted.add(applied);
        }

        remainingDiscount = surplus;
      }

      // 2e. Distribuir el dinero físico (paymentAmount / cash) SEGUNDO
      //     usando applyPaymentDetailed para registrar interés pagado y capital pagado.
      let remainingPayment = paymentAmount;

      for (const installment of loan.installments) {
        if (remainingPayment.isZero()) break;
        if (installment.isPaid) continue;

        const { surplus, interestPaid, capitalPaid } =
          installment.applyPaymentDetailed(remainingPayment);

        if (!interestPaid.isZero() || !capitalPaid.isZero()) {
          const entry = getOrCreateSettled(installment);
          entry.interestPaid = entry.interestPaid.add(interestPaid);
          entry.capitalPaid = entry.capitalPaid.add(capitalPaid);
        }

        remainingPayment = surplus;
      }

      const settledInstallments = Array.from(settledMap.values());

      // 2f. Persistir en la transacción
      const installmentLinks = settledInstallments.map(
        ({
          installment,
          interestPaid,
          capitalPaid,
          interestDiscounted,
          capitalDiscounted,
        }) => ({
          installmentId: installment.id!,
          interestPaid: interestPaid.toString(),
          capitalPaid: capitalPaid.toString(),
          interestDiscounted: interestDiscounted.toString(),
          capitalDiscounted: capitalDiscounted.toString(),
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
          ({
            installment,
            interestPaid,
            capitalPaid,
            interestDiscounted,
            capitalDiscounted,
          }) => ({
            installmentId: installment.id!,
            installmentNumber: installment.installmentNumber,
            amountApplied: interestPaid.add(capitalPaid).toNumber(),
            discountApplied: interestDiscounted
              .add(capitalDiscounted)
              .toNumber(),
          }),
        ),
        loanStatus: loan.status,
        outstandingBalance: loan.outstandingBalance.toNumber(),
      };
    });
  }
}
