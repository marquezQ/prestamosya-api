import { InstallmentEntity } from './installment.entity';
import { InstallmentStatus } from '../enums';
import { Money } from '../value-objects/money.vo';

/** Helper: crea una cuota con valores por defecto que se pueden sobreescribir. */
function createInstallment(
  overrides: Partial<{
    totalAmount: number;
    paidAmount: number;
    status: InstallmentStatus;
    archived: boolean;
  }> = {},
): InstallmentEntity {
  const currency = 'BOB' as const;
  return new InstallmentEntity(
    'inst-1',
    'loan-1',
    1,
    new Date('2026-09-01'),
    Money.of(300, currency),
    Money.of(100, currency),
    Money.of(overrides.totalAmount ?? 400, currency),
    Money.of(overrides.paidAmount ?? 0, currency),
    overrides.status ?? InstallmentStatus.PENDING,
    0,
    null,
    overrides.archived ?? false,
  );
}

describe('InstallmentEntity', () => {
  // ─── remainingAmount ─────────────────────────────────────

  describe('remainingAmount', () => {
    it('should return totalAmount when nothing is paid', () => {
      const inst = createInstallment();
      expect(inst.remainingAmount.toNumber()).toBe(400);
    });

    it('should return difference when partially paid', () => {
      const inst = createInstallment({ paidAmount: 150 });
      expect(inst.remainingAmount.toNumber()).toBe(250);
    });

    it('should return zero when fully paid', () => {
      const inst = createInstallment({
        paidAmount: 400,
        status: InstallmentStatus.PAID,
      });
      expect(inst.remainingAmount.toNumber()).toBe(0);
    });
  });

  // ─── applyPayment ───────────────────────────────────────

  describe('applyPayment()', () => {
    it('should apply exact payment and mark as PAID', () => {
      const inst = createInstallment({ totalAmount: 400 });
      const surplus = inst.applyPayment(Money.of(400, 'BOB'));

      expect(inst.paidAmount.toNumber()).toBe(400);
      expect(inst.status).toBe(InstallmentStatus.PAID);
      expect(inst.paidAt).not.toBeNull();
      expect(surplus.toNumber()).toBe(0);
    });

    it('should apply partial payment and mark as PARTIAL', () => {
      const inst = createInstallment({ totalAmount: 400 });
      const surplus = inst.applyPayment(Money.of(150, 'BOB'));

      expect(inst.paidAmount.toNumber()).toBe(150);
      expect(inst.status).toBe(InstallmentStatus.PARTIAL);
      expect(inst.paidAt).toBeNull();
      expect(surplus.toNumber()).toBe(0);
    });

    it('should cap at totalAmount and return surplus', () => {
      const inst = createInstallment({ totalAmount: 400 });
      const surplus = inst.applyPayment(Money.of(600, 'BOB'));

      expect(inst.paidAmount.toNumber()).toBe(400);
      expect(inst.status).toBe(InstallmentStatus.PAID);
      expect(surplus.toNumber()).toBe(200);
    });

    it('should accumulate multiple partial payments', () => {
      const inst = createInstallment({ totalAmount: 400 });

      inst.applyPayment(Money.of(100, 'BOB'));
      expect(inst.paidAmount.toNumber()).toBe(100);
      expect(inst.status).toBe(InstallmentStatus.PARTIAL);

      inst.applyPayment(Money.of(100, 'BOB'));
      expect(inst.paidAmount.toNumber()).toBe(200);
      expect(inst.status).toBe(InstallmentStatus.PARTIAL);

      inst.applyPayment(Money.of(200, 'BOB'));
      expect(inst.paidAmount.toNumber()).toBe(400);
      expect(inst.status).toBe(InstallmentStatus.PAID);
    });

    it('should return full amount as surplus for PAID installments', () => {
      const inst = createInstallment({
        totalAmount: 400,
        paidAmount: 400,
        status: InstallmentStatus.PAID,
      });

      const surplus = inst.applyPayment(Money.of(100, 'BOB'));
      expect(surplus.toNumber()).toBe(100);
    });

    it('should return full amount as surplus for archived installments', () => {
      const inst = createInstallment({ archived: true });

      const surplus = inst.applyPayment(Money.of(100, 'BOB'));
      expect(surplus.toNumber()).toBe(100);
    });
  });

  // ─── revertPayment ──────────────────────────────────────

  describe('revertPayment()', () => {
    it('should subtract from paidAmount and recalculate status', () => {
      const inst = createInstallment({
        totalAmount: 400,
        paidAmount: 400,
        status: InstallmentStatus.PAID,
      });

      inst.revertPayment(Money.of(200, 'BOB'));

      expect(inst.paidAmount.toNumber()).toBe(200);
      expect(inst.status).toBe(InstallmentStatus.PARTIAL);
      expect(inst.paidAt).toBeNull();
    });

    it('should revert to PENDING when paidAmount reaches zero', () => {
      const inst = createInstallment({
        totalAmount: 400,
        paidAmount: 100,
        status: InstallmentStatus.PARTIAL,
      });

      inst.revertPayment(Money.of(100, 'BOB'));

      expect(inst.paidAmount.toNumber()).toBe(0);
      expect(inst.status).toBe(InstallmentStatus.PENDING);
    });
  });

  // ─── recalculateStatus ──────────────────────────────────

  describe('recalculateStatus()', () => {
    it('should preserve OVERDUE when paidAmount is zero', () => {
      const inst = createInstallment({ status: InstallmentStatus.OVERDUE });

      inst.recalculateStatus();

      expect(inst.status).toBe(InstallmentStatus.OVERDUE);
    });

    it('should change OVERDUE to PARTIAL on partial payment', () => {
      const inst = createInstallment({ status: InstallmentStatus.OVERDUE });

      inst.applyPayment(Money.of(100, 'BOB'));

      expect(inst.status).toBe(InstallmentStatus.PARTIAL);
    });

    it('should change OVERDUE to PAID on full payment', () => {
      const inst = createInstallment({
        totalAmount: 400,
        status: InstallmentStatus.OVERDUE,
      });

      inst.applyPayment(Money.of(400, 'BOB'));

      expect(inst.status).toBe(InstallmentStatus.PAID);
    });
  });

  // ─── archive ────────────────────────────────────────────

  describe('archive()', () => {
    it('should mark the installment as archived', () => {
      const inst = createInstallment();
      expect(inst.isArchived).toBe(false);

      inst.archive();
      expect(inst.isArchived).toBe(true);
    });
  });
});
