import { LoanRepository } from '../../domain/repositories/loan.repository';
import { InstallmentRepository } from '../../domain/repositories/installment.repository';
import { PaymentRepository } from '../../domain/repositories/payment.repository';

/**
 * Interface/Puerto para el patrón Unit of Work.
 *
 * Permite a los casos de uso (Application Layer) ejecutar múltiples operaciones
 * sobre distintos repositorios dentro de un límite transaccional atómico
 * ("todo o nada"), sin conocer los detalles de Prisma ($transaction).
 *
 * @example
 * ```typescript
 * await this.unitOfWork.execute(async (repos) => {
 *   const loan = await repos.loans.save(loanEntity, installments);
 *   // Si algo falla dentro del callback, la transacción hace rollback automático.
 *   return loan;
 * });
 * ```
 */
export abstract class UnitOfWork {
  abstract execute<T>(
    work: (repos: {
      loans: LoanRepository;
      installments: InstallmentRepository;
      payments: PaymentRepository;
    }) => Promise<T>,
  ): Promise<T>;
}
