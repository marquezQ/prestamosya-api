import { LoanEntity } from '../entities/loan.entity';
import { InstallmentEntity } from '../entities/installment.entity';

/**
 * Contrato abstracto (puerto de salida) para la persistencia de préstamos.
 *
 * Se define como abstract class para funcionar como tipo TypeScript
 * y como token de Inyección de Dependencias (DI) en NestJS.
 *
 * Libre de cualquier dependencia de Prisma o NestJS.
 */
export abstract class LoanRepository {
  /** Busca un préstamo por su ID. */
  abstract findById(id: string): Promise<LoanEntity | null>;

  /** Busca un préstamo por su ID e incluye sus cuotas activas. */
  abstract findByIdWithInstallments(id: string): Promise<LoanEntity | null>;

  /** Busca los préstamos de un cliente específico. */
  abstract findByClientId(clientId: string): Promise<LoanEntity[]>;

  /**
   * Persiste un nuevo préstamo junto con sus cuotas en una sola transacción/operación.
   *
   * @param loan - Entidad préstamo
   * @param installments - Lista de cuotas asociadas
   */
  abstract save(
    loan: LoanEntity,
    installments: InstallmentEntity[],
  ): Promise<LoanEntity>;

  /** Actualiza las propiedades mutables de un préstamo existente (saldo, estado, totalPaid). */
  abstract update(loan: LoanEntity): Promise<void>;
}
