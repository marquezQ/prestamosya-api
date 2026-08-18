/**
 * Tipo de período entre cuotas.
 * Determina cómo se calculan las fechas de vencimiento
 * en el LoanCalculatorService.
 */
export enum PeriodType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  FORTNIGHTLY = 'fortnightly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}
