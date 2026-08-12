/**
 * Modo de creación del préstamo.
 * - AUTOMATIC: el sistema calcula las cuotas según fórmula flat rate.
 * - MANUAL: el admin define fecha y monto de cada cuota libremente.
 */
export enum LoanMode {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
}
