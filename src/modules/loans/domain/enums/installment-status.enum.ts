/**
 * Estado de una cuota en el dominio.
 * OVERDUE se asigna externamente por el cron de mora,
 * no por la lógica interna de la entidad.
 */
export enum InstallmentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}
