import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus } from '../../domain/enums';
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
 * Resultado interno de la transacción — incluye metadatos necesarios
 * para la actualización del estado del cliente post-commit.
 */
interface TxResult {
  clientId: string;
  paymentId: string;
  loanId: string;
  loanStatus: LoanStatus; // Tipo fuerte para comparaciones seguras post-transacción
  amount: number;
  method: string;
  paymentDate: string;
  notes: string | null;
  outstandingBalance: number;
  affectedInstallments: AffectedInstallmentResult[];
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

    // 2. Ejecutar la transacción atómica (pago + cuotas + préstamo).
    //    El callback NO toca this.prisma directamente: todo usa el cliente
    //    transaccional `tx` a través de los repos. Así la transacción se
    //    completa y libera su conexión del pool antes de continuar.
    const tx = await this.unitOfWork.execute(
      async (repos): Promise<TxResult> => {
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
        loan.applyPayment(paymentAmount, new Date(input.paymentDate));

        // 2c. Distribuir FIFO entre cuotas pendientes (Interés primero, Capital después)
        let remaining = paymentAmount;
        const affectedInstallments: Array<{
          installment: InstallmentEntity;
          interestPaid: Money;
          capitalPaid: Money;
        }> = [];

        for (const installment of loan.installments) {
          if (remaining.isZero()) break;

          const { surplus, interestPaid, capitalPaid } =
            installment.applyPaymentDetailed(remaining);

          if (!interestPaid.isZero() || !capitalPaid.isZero()) {
            affectedInstallments.push({
              installment,
              interestPaid,
              capitalPaid,
            });
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
            ({ installment, interestPaid, capitalPaid }) => ({
              installmentId: installment.id!,
              interestPaid: interestPaid.toString(),
              capitalPaid: capitalPaid.toString(),
              interestDiscounted: '0.00',
              capitalDiscounted: '0.00',
            }),
          ),
        });

        // Actualizar cuotas afectadas (paidAmount, status, paidAt)
        await repos.installments.updateMany(
          affectedInstallments.map(({ installment }) => installment),
        );

        // Actualizar préstamo (totalPaid, outstandingBalance, status)
        await repos.loans.update(loan);

        // 2e. Retornar TxResult — incluye clientId para la actualización
        //     post-transacción y loanStatus tipado fuerte para comparaciones seguras.
        //     El estado del cliente se actualiza DESPUÉS de que T1 haga commit
        //     para evitar la violación de atomicidad que ocurría al llamar
        //     this.prisma dentro del callback.
        return {
          clientId: loan.clientId,
          paymentId,
          loanId: loan.id!,
          loanStatus: loan.status,
          amount: paymentAmount.toNumber(),
          method: input.method,
          paymentDate: input.paymentDate,
          notes: input.notes ?? null,
          outstandingBalance: loan.outstandingBalance.toNumber(),
          affectedInstallments: affectedInstallments.map(
            ({ installment, interestPaid, capitalPaid }) => ({
              installmentId: installment.id!,
              installmentNumber: installment.installmentNumber,
              amountApplied: interestPaid.add(capitalPaid).toNumber(),
              newStatus: installment.status,
              remainingAmount: installment.remainingAmount.toNumber(),
            }),
          ),
        };
      },
    );

    // 3. Post-transacción: T1 ya hizo COMMIT y liberó su conexión.
    //    Si el préstamo quedó COMPLETED, evaluar si el cliente tiene otros
    //    préstamos activos. Si no tiene ninguno, volver a NO_LOAN.
    //    Si este UPDATE falla, el cron de las 6 AM corrige el estado.
    if (tx.loanStatus === LoanStatus.COMPLETED) {
      const activeLoanCount = await this.prisma.loan.count({
        where: {
          clientId: tx.clientId,
          status: LoanStatus.ACTIVE,
          id: { not: tx.loanId }, // Excluir el préstamo recién completado
        },
      });

      if (activeLoanCount === 0) {
        await this.prisma.client.update({
          where: { id: tx.clientId },
          data: { status: 'NO_LOAN' },
        });
      }
    }

    // 4. Construir y retornar el resultado público (sin clientId)
    return {
      paymentId: tx.paymentId,
      loanId: tx.loanId,
      loanStatus: tx.loanStatus,
      amount: tx.amount,
      method: tx.method,
      paymentDate: tx.paymentDate,
      notes: tx.notes,
      outstandingBalance: tx.outstandingBalance,
      affectedInstallments: tx.affectedInstallments,
    };
  }
}
