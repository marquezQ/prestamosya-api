import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import { Money } from '../../domain/value-objects/money.vo';
import { UnitOfWork } from '../ports/unit-of-work.port';

/**
 * Datos de entrada para registrar un pago.
 * Viene del DTO HTTP, ya validado por class-validator.
 */
export interface RegisterPaymentInput {
  loanId: string;
  amount: number;
  method: 'cash' | 'transfer';
  paymentDate: string; // YYYY-MM-DD
  notes?: string;
}

/**
 * Detalle de cada cuota afectada por el pago.
 */
export interface AffectedInstallmentResult {
  installmentId: string;
  installmentNumber: number;
  amountApplied: number;
  newStatus: string;
  remainingAmount: number;
}

/**
 * Resultado del caso de uso — se mapea a la respuesta HTTP en el controller.
 */
export interface RegisterPaymentResult {
  paymentId: string;
  loanId: string;
  amount: number;
  method: string;
  paymentDate: string;
  notes: string | null;
  affectedInstallments: AffectedInstallmentResult[];
  loanStatus: string;
  outstandingBalance: number;
}

/**
 * Caso de uso: Registrar un pago sobre un préstamo.
 *
 * Flujo:
 * 1. Validar que el préstamo existe y pertenece al admin (ownership)
 * 2. Cargar el préstamo con sus cuotas pendientes en orden FIFO (dueDate ASC)
 * 3. Distribuir el monto entre las cuotas usando el patrón cadena (surplus)
 * 4. Aplicar el pago total al préstamo (actualiza outstandingBalance, totalPaid, status)
 * 5. Persistir todo en una transacción atómica:
 *    - Crear Payment
 *    - Crear PaymentInstallments (uno por cuota afectada)
 *    - Actualizar cuotas (paidAmount, status, paidAt)
 *    - Actualizar préstamo (totalPaid, outstandingBalance, status)
 *
 * Nota sobre FIFO: las cuotas se cargan ordenadas por dueDate ASC
 * (la más vieja primero). El monto se aplica en ese orden hasta agotarse.
 * Cuotas ya pagadas (PAID) y archivadas se excluyen de la query.
 */
@Injectable()
export class RegisterPaymentUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    userId: string,
    input: RegisterPaymentInput,
  ): Promise<RegisterPaymentResult> {
    // 1. Validar ownership antes de abrir la transacción
    //    Un admin solo puede registrar pagos en préstamos de sus propios clientes.
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

      // 2b. Aplicar el pago al préstamo (valida que esté ACTIVE y que el monto
      //     no supere el outstandingBalance — lanza LoanDomainError si falla)
      //     Lo hacemos ANTES del FIFO para que la validación ocurra primero.
      //     LoanEntity.applyPayment() lanza:
      //       - LoanNotActiveError si el préstamo no está activo
      //       - PaymentExceedsBalanceError si el monto supera el saldo
      loan.applyPayment(paymentAmount);

      // 2c. Distribuir FIFO entre cuotas pendientes
      //     installment.applyPayment(amount) retorna el sobrante que no se pudo aplicar.
      //     Iteramos hasta que el sobrante sea 0 o se acaben las cuotas.
      let remaining = paymentAmount;
      const affectedInstallments: Array<{
        installment: InstallmentEntity;
        applied: Money;
      }> = [];

      for (const installment of loan.installments) {
        if (remaining.isZero()) break;

        const surplus = installment.applyPayment(remaining);
        const applied = remaining.subtract(surplus);

        if (!applied.isZero()) {
          affectedInstallments.push({ installment, applied });
        }

        remaining = surplus;
      }

      // 2d. Persistir en la transacción
      const paymentId = await repos.payments.create({
        loanId: loan.id!,
        registeredBy: userId,
        amount: paymentAmount.toString(),
        paymentDate: new Date(input.paymentDate),
        method: input.method,
        notes: input.notes ?? null,
        installmentLinks: affectedInstallments.map(
          ({ installment, applied }) => ({
            installmentId: installment.id!,
            amountApplied: applied.toString(),
          }),
        ),
      });

      // Actualizar cuotas afectadas (paidAmount, status, paidAt)
      await repos.installments.updateMany(
        affectedInstallments.map(({ installment }) => installment),
      );

      // Actualizar préstamo (totalPaid, outstandingBalance, status)
      await repos.loans.update(loan);

      // 2e. Construir resultado
      return {
        paymentId,
        loanId: loan.id!,
        amount: paymentAmount.toNumber(),
        method: input.method,
        paymentDate: input.paymentDate,
        notes: input.notes ?? null,
        affectedInstallments: affectedInstallments.map(
          ({ installment, applied }) => ({
            installmentId: installment.id!,
            installmentNumber: installment.installmentNumber,
            amountApplied: applied.toNumber(),
            newStatus: installment.status,
            remainingAmount: installment.remainingAmount.toNumber(),
          }),
        ),
        loanStatus: loan.status,
        outstandingBalance: loan.outstandingBalance.toNumber(),
      };
    });
  }
}
