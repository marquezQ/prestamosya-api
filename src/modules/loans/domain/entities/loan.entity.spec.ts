import Decimal from 'decimal.js';
import { LoanEntity } from './loan.entity';
import { InstallmentEntity } from './installment.entity';
import { LoanStatus, LoanMode, PeriodType, InstallmentStatus } from '../enums';
import { Money } from '../value-objects/money.vo';
import {
  LoanNotActiveError,
  PaymentExceedsBalanceError,
  LoanNotRefinancableError,
  SettlementExceedsBalanceError,
  SettlementDoesNotClearBalanceError,
  DiscountExceedsPendingInterestError,
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

      loan.applyPayment(Money.of(400, 'BOB'), new Date());

      expect(loan.outstandingBalance.toNumber()).toBe(900);
      expect(loan.totalPaid.toNumber()).toBe(400);
      expect(loan.status).toBe(LoanStatus.ACTIVE);
    });

    it('should mark as COMPLETED when balance reaches zero', () => {
      const loan = createLoan({ outstandingBalance: 500, totalPaid: 800 });

      loan.applyPayment(Money.of(500, 'BOB'), new Date());

      expect(loan.outstandingBalance.toNumber()).toBe(0);
      expect(loan.totalPaid.toNumber()).toBe(1300);
      expect(loan.status).toBe(LoanStatus.COMPLETED);
    });

    it('should throw PaymentExceedsBalanceError when amount exceeds balance', () => {
      const loan = createLoan({ outstandingBalance: 100 });

      expect(() => loan.applyPayment(Money.of(200, 'BOB'), new Date())).toThrow(
        PaymentExceedsBalanceError,
      );
    });

    it('should throw LoanNotActiveError when loan is not active', () => {
      const loan = createLoan({ status: LoanStatus.COMPLETED });

      expect(() => loan.applyPayment(Money.of(100, 'BOB'), new Date())).toThrow(
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

  // ─── totalPendingInterest ──────────────────────────────

  describe('totalPendingInterest', () => {
    /**
     * Crea una cuota con capital e interés explícitos.
     * paidAmount = 0 por defecto (cuota sin pagar).
     */
    function makeInstallment(
      id: string,
      capital: number,
      interest: number,
      paidAmount = 0,
      status: InstallmentStatus = InstallmentStatus.PENDING,
      archived = false,
    ): InstallmentEntity {
      const currency = 'BOB' as const;
      const total = capital + interest;
      return new InstallmentEntity(
        id,
        'loan-1',
        1,
        new Date(),
        Money.of(capital, currency),
        Money.of(interest, currency),
        Money.of(total, currency),
        Money.of(paidAmount, currency),
        status,
        0,
        null,
        archived,
      );
    }

    it('should sum unpaid interest across all pending installments', () => {
      // 3 cuotas: cada una con 100 de interés → total pendiente = 300
      const installments = [
        makeInstallment('i1', 333.33, 100),
        makeInstallment('i2', 333.33, 100),
        makeInstallment('i3', 333.34, 100),
      ];
      const loan = createLoan({ installments, outstandingBalance: 1300 });
      expect(loan.totalPendingInterest.toNumber()).toBe(300);
    });

    it('should exclude already-paid installments', () => {
      const installments = [
        makeInstallment('i1', 333.33, 100, 433.33, InstallmentStatus.PAID), // pagada completa
        makeInstallment('i2', 333.33, 100),
        makeInstallment('i3', 333.34, 100),
      ];
      const loan = createLoan({ installments, outstandingBalance: 866.67 });
      expect(loan.totalPendingInterest.toNumber()).toBe(200);
    });

    it('should exclude archived installments', () => {
      const installments = [
        makeInstallment('i1', 333.33, 100, 0, InstallmentStatus.PENDING, true), // archivada
        makeInstallment('i2', 333.33, 100),
        makeInstallment('i3', 333.34, 100),
      ];
      const loan = createLoan({ installments, outstandingBalance: 866.67 });
      expect(loan.totalPendingInterest.toNumber()).toBe(200);
    });

    it('should subtract interest already covered by partial payments', () => {
      // Cuota 1 tiene 100 de interés, se pagaron 60 → quedan 40
      const installments = [
        makeInstallment('i1', 333.33, 100, 60, InstallmentStatus.PARTIAL),
        makeInstallment('i2', 333.33, 100),
      ];
      const loan = createLoan({ installments, outstandingBalance: 773.33 });
      // Cuota 1: 40 interés pendiente + Cuota 2: 100 = 140
      expect(loan.totalPendingInterest.toNumber()).toBe(140);
    });

    it('should return zero when all installments are paid', () => {
      const installments = [
        makeInstallment('i1', 333.33, 100, 433.33, InstallmentStatus.PAID),
        makeInstallment('i2', 333.33, 100, 433.33, InstallmentStatus.PAID),
        makeInstallment('i3', 333.34, 100, 433.34, InstallmentStatus.PAID),
      ];
      const loan = createLoan({
        installments,
        outstandingBalance: 0,
        status: LoanStatus.COMPLETED,
      });
      expect(loan.totalPendingInterest.toNumber()).toBe(0);
    });
  });

  // ─── settleEarly ───────────────────────────────────────

  describe('settleEarly()', () => {
    function makeLoanForSettle(
      pendingCapital: number,
      pendingInterest: number,
    ) {
      const currency = 'BOB' as const;
      const outstandingBalance = pendingCapital + pendingInterest;
      const installment = new InstallmentEntity(
        'i1',
        'loan-1',
        1,
        new Date(),
        Money.of(pendingCapital, currency),
        Money.of(pendingInterest, currency),
        Money.of(outstandingBalance, currency),
        Money.zero(currency),
        InstallmentStatus.PENDING,
        0,
        null,
        false,
      );
      return createLoan({ installments: [installment], outstandingBalance });
    }

    it('should settle with discount exactly equal to pending interest', () => {
      // Capital 1000, interés 300 → se paga 1000 en efectivo + 300 condonados
      const loan = makeLoanForSettle(1000, 300);
      loan.settleEarly(
        Money.of(1000, 'BOB'), // El cliente paga solo el capital
        Money.of(300, 'BOB'), // Se condona todo el interés
        new Date(),
      );
      expect(loan.status).toBe(LoanStatus.COMPLETED);
      expect(loan.outstandingBalance.toNumber()).toBe(0);
      expect(loan.totalPaid.toNumber()).toBe(1000);
    });

    it('should settle with discount less than pending interest', () => {
      // Capital 1000, interés 300 → se paga 1100 + se condona 200
      const loan = makeLoanForSettle(1000, 300);
      loan.settleEarly(Money.of(1100, 'BOB'), Money.of(200, 'BOB'), new Date());
      expect(loan.status).toBe(LoanStatus.COMPLETED);
      expect(loan.totalPaid.toNumber()).toBe(1100);
    });

    it('should settle without any discount', () => {
      const loan = makeLoanForSettle(1000, 300);
      loan.settleEarly(Money.of(1300, 'BOB'), Money.of(0, 'BOB'), new Date());
      expect(loan.status).toBe(LoanStatus.COMPLETED);
    });

    it('should throw DiscountExceedsPendingInterestError when discount > pending interest', () => {
      // Capital 1000, interés 300 → descuento de 350 toca capital → RECHAZADO
      const loan = makeLoanForSettle(1000, 300);
      expect(() =>
        loan.settleEarly(
          Money.of(950, 'BOB'), // 950 + 350 = 1300 (cuadra el balance)
          Money.of(350, 'BOB'), // Pero 350 > 300 (interés pendiente) → ERROR
          new Date(),
        ),
      ).toThrow(DiscountExceedsPendingInterestError);
    });

    it('should throw DiscountExceedsPendingInterestError even when total matches balance', () => {
      // Exactamente el escenario del bug: amount + discount == outstandingBalance
      // pero discount supera el interés → debería fallar
      const loan = makeLoanForSettle(1000, 0); // préstamo sin interés (capital puro)
      expect(() =>
        loan.settleEarly(
          Money.of(950, 'BOB'),
          Money.of(50, 'BOB'), // 50 > 0 de interés → toca capital → ERROR
          new Date(),
        ),
      ).toThrow(DiscountExceedsPendingInterestError);
    });

    it('should throw SettlementExceedsBalanceError when total exceeds balance', () => {
      const loan = makeLoanForSettle(1000, 300);
      expect(() =>
        loan.settleEarly(
          Money.of(1200, 'BOB'),
          Money.of(200, 'BOB'), // 1400 > 1300
          new Date(),
        ),
      ).toThrow(SettlementExceedsBalanceError);
    });

    it('should throw SettlementDoesNotClearBalanceError when total is less than balance', () => {
      const loan = makeLoanForSettle(1000, 300);
      expect(() =>
        loan.settleEarly(
          Money.of(900, 'BOB'),
          Money.of(200, 'BOB'), // 1100 < 1300
          new Date(),
        ),
      ).toThrow(SettlementDoesNotClearBalanceError);
    });

    it('should throw LoanNotActiveError when loan is already completed', () => {
      const loan = makeLoanForSettle(0, 0);
      loan['status'] = LoanStatus.COMPLETED; // forzar estado
      expect(() =>
        loan.settleEarly(Money.of(0, 'BOB'), Money.of(0, 'BOB'), new Date()),
      ).toThrow(LoanNotActiveError);
    });
  });
});
