import { InstallmentEntity } from '../entities/installment.entity';

/**
 * Contrato abstracto (puerto de salida) para la persistencia de cuotas.
 *
 * Se define como abstract class para funcionar como tipo TypeScript
 * y como token de Inyección de Dependencias (DI) en NestJS.
 */
export abstract class InstallmentRepository {
  /** Busca cuotas por ID de préstamo. */
  abstract findByLoanId(
    loanId: string,
    onlyActive?: boolean,
  ): Promise<InstallmentEntity[]>;

  /** Guarda múltiples cuotas nuevas. */
  abstract saveMany(
    loanId: string,
    installments: InstallmentEntity[],
  ): Promise<void>;

  /** Actualiza múltiples cuotas existentes (paidAmount, status, paidAt, etc.). */
  abstract updateMany(installments: InstallmentEntity[]): Promise<void>;

  /** Marca como archivadas (archived=true) las cuotas activas de un préstamo (usado en refinanciamiento). */
  abstract archiveByLoanId(loanId: string): Promise<void>;
}
