/**
 * Tipos de datos para el puerto PaymentRepository.
 *
 * Se usan tipos planos (string para decimales, Date para fechas)
 * en lugar del Value Object Money para mantener este puerto simple
 * y evitar acoplar los tipos de infraestructura al dominio.
 *
 * El use case es responsable de convertir Money → string antes de llamar al repo.
 */

export interface CreatePaymentData {
  loanId: string;
  registeredBy: string; // userId del admin que registra el pago
  amount: string; // Decimal como string (ej: "500.00")
  discountAmount?: string; // Interés condonado en liquidación anticipada (ej: "100.00"). Omitir en pagos normales.
  paymentDate: Date;
  method: 'cash' | 'transfer';
  notes: string | null;
  installmentLinks: Array<{
    installmentId: string;
    amountApplied: string; // Decimal como string (ej: "400.00")
  }>;
}

export interface PaymentInstallmentLink {
  id: string;
  installmentId: string;
  amountApplied: string;
}

export interface PaymentRecord {
  id: string;
  loanId: string;
  registeredBy: string;
  amount: string;
  paymentDate: Date;
  method: string;
  notes: string | null;
  voided: boolean;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  installmentLinks: PaymentInstallmentLink[];
}

/**
 * Puerto (contrato abstracto) para la persistencia de pagos.
 *
 * Se define como abstract class para funcionar como token
 * de Inyección de Dependencias (DI) en NestJS.
 *
 * Payment es un registro de auditoría financiera:
 * - Nunca se elimina — solo se anula (voided=true)
 * - Su creación es siempre atómica con la actualización de installments y loan
 * - Por eso este repo DEBE usarse siempre dentro de un UnitOfWork
 */
export abstract class PaymentRepository {
  /**
   * Crea un Payment y sus PaymentInstallments asociados en una sola operación.
   *
   * @returns El ID del Payment creado
   */
  abstract create(data: CreatePaymentData): Promise<string>;

  /**
   * Busca un payment por ID, incluyendo sus links a cuotas.
   * Retorna null si no existe.
   */
  abstract findById(id: string): Promise<PaymentRecord | null>;

  /**
   * Marca un payment como anulado.
   * No elimina el registro — solo actualiza voided, voidedAt y voidReason.
   */
  abstract markVoided(id: string, reason: string): Promise<void>;
}
