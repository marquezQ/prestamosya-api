/**
 * Errores de dominio del módulo loans.
 *
 * Estos errores son TypeScript puro — no extienden HttpException de NestJS.
 * La capa de infraestructura (controller) es responsable de traducir
 * estos errores a respuestas HTTP apropiadas.
 */

export class LoanDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoanDomainError';
  }
}

export class PaymentExceedsBalanceError extends LoanDomainError {
  constructor(paymentAmount: string, outstandingBalance: string) {
    super(
      `Payment amount (${paymentAmount}) exceeds outstanding balance (${outstandingBalance})`,
    );
    this.name = 'PaymentExceedsBalanceError';
  }
}

export class LoanNotActiveError extends LoanDomainError {
  constructor(loanId: string, currentStatus: string) {
    super(`Loan ${loanId} is not active (current status: ${currentStatus})`);
    this.name = 'LoanNotActiveError';
  }
}

export class LoanNotRefinancableError extends LoanDomainError {
  constructor(loanId: string, reason: string) {
    super(`Loan ${loanId} cannot be refinanced: ${reason}`);
    this.name = 'LoanNotRefinancableError';
  }
}

export class CurrencyMismatchError extends LoanDomainError {
  constructor(expected: string, received: string) {
    super(`Cannot mix currencies: expected ${expected}, received ${received}`);
    this.name = 'CurrencyMismatchError';
  }
}

export class InvalidInstallmentsError extends LoanDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInstallmentsError';
  }
}
