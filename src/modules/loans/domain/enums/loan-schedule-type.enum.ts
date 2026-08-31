/**
 * Tipo de cronograma de cuotas para préstamos en modo AUTOMATIC.
 *
 * - EQUAL_INSTALLMENTS: Cuotas iguales — capital + interés distribuido
 *   equitativamente en cada cuota (modelo estándar).
 *   Ej: Bs 1.000 al 10% / 3 meses → 3 cuotas de Bs 433.33
 *
 * - INTEREST_ONLY: Solo interés por cuota, capital completo en la última
 *   (modelo Balloon, muy común en Bolivia para préstamos informales).
 *   Ej: Bs 1.000 al 10% / 3 meses → Bs 100, Bs 100, Bs 1.100
 */
export enum LoanScheduleType {
  EQUAL_INSTALLMENTS = 'EQUAL_INSTALLMENTS',
  INTEREST_ONLY = 'INTEREST_ONLY',
}
