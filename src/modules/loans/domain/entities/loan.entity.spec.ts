import Decimal from 'decimal.js';
import { LoanEntity } from './loan.entity';
import { InstallmentEntity } from './installment.entity';
import { LoanStatus, LoanMode, PeriodType, InstallmentStatus } from '../enums';
import { Money } from '../value-objects/money.vo';
import {
  LoanNotActiveError,
  PaymentExceedsBalanceError,
  LoanNotRefinancableError,
} from '../errors/loan-domain.errors';

/** Helper: crea un préstamo con valores por defecto. */
function createLoan(
  overrides: Partial<{
    outstandingBalance: number;
    totalPaid: number;
    status: LoanStatus;
    installments: InstallmentEntity[];
  }> = {},
): LoanEntity {
  const currency = 'BOB' as const;
  return new LoanEntity(
    'loan-1',
    'client-1',
    'user-1',
    LoanMode.AUTOMATIC,
    Money.of(1000, currency),
    new Decimal('10'),
    PeriodType.MONTHLY,
    3,
    Money.of(1300, currency),
    Money.of(overrides.totalPaid ?? 0, currency),
    Money.of(overrides.outstandingBalance ?? 1300, currency),
    overrides.status ?? LoanStatus.ACTIVE,
    new Date('2026-08-01'),
    new Date('2026-09-01'),
    null,
    overrides.installments ?? [],
  );
}

describe('LoanEntity', () => {
  // ─── State queries ──────────────────────────────────────

  describe('isActive', () => {
    it('should return true when status is ACTIVE', () => {
      const loan = createLoan({ status: LoanStatus.ACTIVE });
      expect(loan.isActive).toBe(true);
    });

    it('should return false when status is COMPLETED', () => {
      const loan = createLoan({ status: LoanStatus.COMPLETED });
      expect(loan.isActive).toBe(false);
    });
  });

  describe('canBeRefinanced()', () => {
    it('should return true when ACTIVE and has outstanding balance', () => {
      const loan = createLoan({
        status: LoanStatus.ACTIVE,
        outstandingBalance: 500,
      });
      expect(loan.canBeRefinanced()).toBe(true);
    });

    it('should return false when COMPLETED', () => {
      const loan = createLoan({
        status: LoanStatus.COMPLETED,
        outstandingBalance: 0,
      });
      expect(loan.canBeRefinanced()).toBe(false);
    });

    it('should return false when ACTIVE but balance is zero', () => {
      const loan = createLoan({
        status: LoanStatus.ACTIVE,
        outstandingBalance: 0,
      });
      expect(loan.canBeRefinanced()).toBe(false);
    });

    it('should return false when REFINANCED', () => {
      const loan = createLoan({
        status: LoanStatus.REFINANCED,
        outstandingBalance: 500,
      });
      expect(loan.canBeRefinanced()).toBe(false);
    });
  });

  describe('canReceivePayment()', () => {
    it('should return true when ACTIVE', () => {
      const loan = createLoan({ status: LoanStatus.ACTIVE });
      expect(loan.canReceivePayment()).toBe(true);
    });

    it('should return false when COMPLETED', () => {
      const loan = createLoan({ status: LoanStatus.COMPLETED });
      expect(loan.canReceivePayment()).toBe(false);
    });
  });

  // ─── applyPayment ──────────────────────────────────────

  describe('applyPayment()', () => {
    it('should reduce outstanding balance and increase totalPaid', () => {
      const loan = createLoan({ outstandingBalance: 1300, totalPaid: 0 });

      loan.applyPayment(Money.of(400, 'BOB'));

      expect(loan.outstandingBalance.toNumber()).toBe(900);
      expect(loan.totalPaid.toNumber()).toBe(400);
      expect(loan.status).toBe(LoanStatus.ACTIVE);
    });

    it('should mark as COMPLETED when balance reaches zero', () => {
      const loan = createLoan({ outstandingBalance: 500, totalPaid: 800 });

      loan.applyPayment(Money.of(500, 'BOB'));

      expect(loan.outstandingBalance.toNumber()).toBe(0);
      expect(loan.totalPaid.toNumber()).toBe(1300);
      expect(loan.status).toBe(LoanStatus.COMPLETED);
    });

    it('should throw PaymentExceedsBalanceError when amount exceeds balance', () => {
      const loan = createLoan({ outstandingBalance: 100 });

      expect(() => loan.applyPayment(Money.of(200, 'BOB'))).toThrow(
        PaymentExceedsBalanceError,
      );
    });

    it('should throw LoanNotActiveError when loan is not active', () => {
      const loan = createLoan({ status: LoanStatus.COMPLETED });

      expect(() => loan.applyPayment(Money.of(100, 'BOB'))).toThrow(
        LoanNotActiveError,
      );
    });
  });

  // ─── revertPayment ─────────────────────────────────────

  describe('revertPayment()', () => {
    it('should restore outstanding balance and reduce totalPaid', () => {
      const loan = createLoan({ outstandingBalance: 900, totalPaid: 400 });

      loan.revertPayment(Money.of(400, 'BOB'));

      expect(loan.outstandingBalance.toNumber()).toBe(1300);
      expect(loan.totalPaid.toNumber()).toBe(0);
    });

    it('should change COMPLETED back to ACTIVE', () => {
      const loan = createLoan({
        outstandingBalance: 0,
        totalPaid: 1300,
        status: LoanStatus.COMPLETED,
      });

      loan.revertPayment(Money.of(500, 'BOB'));

      expect(loan.status).toBe(LoanStatus.ACTIVE);
      expect(loan.outstandingBalance.toNumber()).toBe(500);
    });
  });

  // ─── markAsRefinanced ──────────────────────────────────

  describe('markAsRefinanced()', () => {
    it('should change status to REFINANCED', () => {
      const loan = createLoan({
        status: LoanStatus.ACTIVE,
        outstandingBalance: 500,
      });

      loan.markAsRefinanced();

      expect(loan.status).toBe(LoanStatus.REFINANCED);
    });

    it('should throw when loan is not refinancable', () => {
      const loan = createLoan({
        status: LoanStatus.COMPLETED,
        outstandingBalance: 0,
      });

      expect(() => loan.markAsRefinanced()).toThrow(LoanNotRefinancableError);
    });
  });

  // ─── activeInstallments ────────────────────────────────

  describe('activeInstallments', () => {
    it('should filter out archived installments and sort by number', () => {
      const currency = 'BOB' as const;
      const installments = [
        new InstallmentEntity(
          'i3',
          'loan-1',
          3,
          new Date(),
          Money.of(100, currency),
          Money.of(0, currency),
          Money.of(100, currency),
          Money.zero(currency),
          InstallmentStatus.PENDING,
          0,
          null,
          false,
        ),
        new InstallmentEntity(
          'i1',
          'loan-1',
          1,
          new Date(),
          Money.of(100, currency),
          Money.of(0, currency),
          Money.of(100, currency),
          Money.zero(currency),
          InstallmentStatus.PENDING,
          0,
          null,
          true,
        ), // archived
        new InstallmentEntity(
          'i2',
          'loan-1',
          2,
          new Date(),
          Money.of(100, currency),
          Money.of(0, currency),
          Money.of(100, currency),
          Money.zero(currency),
          InstallmentStatus.PENDING,
          0,
          null,
          false,
        ),
      ];

      const loan = createLoan({ installments });

      const active = loan.activeInstallments;
      expect(active).toHaveLength(2);
      expect(active[0].installmentNumber).toBe(2);
      expect(active[1].installmentNumber).toBe(3);
    });
  });

  // ─── currency ──────────────────────────────────────────

  describe('currency', () => {
    it('should return the currency from capitalAmount', () => {
      const loan = createLoan();
      expect(loan.currency).toBe('BOB');
    });
  });
});
