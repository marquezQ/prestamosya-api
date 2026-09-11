import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import {
  PaymentAlreadyVoidedError,
  PaymentNotFoundError,
} from '../../domain/errors/loan-domain.errors';
import { Money } from '../../domain/value-objects/money.vo';
import { UnitOfWork } from '../ports/unit-of-work.port';

/**
 * Caso de uso: Anular un pago previamente registrado.
 *
 * Reglas de negocio:
 * 1. Los pagos NUNCA se eliminan físicamente (soft-void: voided = true, voidedAt, voidReason).
 * 2. Un pago ya anulado no puede volver a anularse.
 * 3. Se revierten los montos aplicados a cada cuota (`InstallmentEntity.revertPayment`).
 * 4. Se revierte el saldo deudor y total pagado en el préstamo (`LoanEntity.revertPayment`).
 * 5. Si el préstamo estaba `COMPLETED`, al anular un pago regresa automáticamente a `ACTIVE`.
 * 6. Todo se ejecuta atómicamente dentro de un `UnitOfWork`.
 */
@Injectable()
export class VoidPaymentUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    userId: string,
    paymentId: string,
    reason: string,
  ): Promise<void> {
    return this.unitOfWork.execute(async (repos) => {
      // 1. Cargar el pago con sus links a cuotas
      const payment = await repos.payments.findById(paymentId);
      if (!payment) {
        throw new PaymentNotFoundError(paymentId);
      }

      if (payment.voided) {
        throw new PaymentAlreadyVoidedError(paymentId);
      }

      // 2. Validar ownership del préstamo al que pertenece el pago
      const loanExists = await this.prisma.loan.findFirst({
        where: {
          id: payment.loanId,
          client: { userId, deletedAt: null },
        },
        select: { id: true },
      });

      if (!loanExists) {
        throw new NotFoundException('Loan not found');
      }

      // 3. Cargar el préstamo con sus cuotas activas
      const loan = await repos.loans.findByIdWithInstallments(payment.loanId);
      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      // 4. Revertir cada cuota vinculada al pago.
      //    Se revierte amountApplied + discountApplied porque ambos suman
      //    al paidAmount de la cuota y deben restaurarse completamente.
      const updatedInstallments: InstallmentEntity[] = [];

      for (const link of payment.installmentLinks) {
        const installment = loan.installments.find(
          (inst) => inst.id === link.installmentId,
        );

        if (installment) {
          const totalApplied = Money.of(
            Number(link.interestPaid) +
              Number(link.capitalPaid) +
              Number(link.interestDiscounted) +
              Number(link.capitalDiscounted),
            loan.currency,
          );
          installment.revertPayment(totalApplied);
          updatedInstallments.push(installment);
        }
      }

      // 5. Revertir el estado y saldo del préstamo.
      //    Se usa amount + discountAmount para restaurar outstandingBalance al valor
      //    original antes del settle (el settle reduce el balance por ambos conceptos).
      const totalReverted = Money.of(
        Number(payment.amount) + Number(payment.discountAmount),
        loan.currency,
      );
      loan.revertPayment(totalReverted);

      // 6. Persistir todo en la transacción
      await repos.payments.markVoided(paymentId, reason);
      await repos.installments.updateMany(updatedInstallments);
      await repos.loans.update(loan);
    });
  }
}
