/**
 * Estado del préstamo en el dominio.
 * Replicado de los enums de Prisma para mantener el domain layer
 * libre de dependencias externas.
 */
export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DEFAULTED = 'DEFAULTED',
  REFINANCED = 'REFINANCED',
}
