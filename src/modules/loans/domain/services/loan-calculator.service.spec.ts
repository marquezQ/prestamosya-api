import Decimal from 'decimal.js';
import { LoanCalculatorService } from './loan-calculator.service';
import { PeriodType } from '../enums';
import { Money } from '../value-objects/money.vo';

describe('LoanCalculatorService', () => {
  let calculator: LoanCalculatorService;

  beforeEach(() => {
    calculator = new LoanCalculatorService();
  });

  describe('calculateInstallments()', () => {
    it('should calculate installments for 1000 BOB / 3 installments / 10% monthly', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(10);

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: 3,
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        periodType: PeriodType.MONTHLY,
      });

      // Total: 1000 + (1000 * 0.10 * 3) = 1300
      expect(result.totalAmount.toNumber()).toBe(1300);
      expect(result.installments).toHaveLength(3);

      expect(result.installments[0].totalAmount.toNumber()).toBe(433.33);
      expect(result.installments[0].capitalAmount.toNumber()).toBe(333.33);
      expect(result.installments[0].interestAmount.toNumber()).toBe(100.0);

      expect(result.installments[1].totalAmount.toNumber()).toBe(433.33);
      expect(result.installments[1].capitalAmount.toNumber()).toBe(333.33);
      expect(result.installments[1].interestAmount.toNumber()).toBe(100.0);

      expect(result.installments[2].totalAmount.toNumber()).toBe(433.34);
      expect(result.installments[2].capitalAmount.toNumber()).toBe(333.34);
      expect(result.installments[2].interestAmount.toNumber()).toBe(100.0);

      const sumTotal = result.installments.reduce(
        (acc, inst) => acc.add(inst.totalAmount),
        Money.zero('BOB'),
      );
      expect(sumTotal.toNumber()).toBe(1300);

      const sumCapital = result.installments.reduce(
        (acc, inst) => acc.add(inst.capitalAmount),
        Money.zero('BOB'),
      );
      expect(sumCapital.toNumber()).toBe(1000);
    });

    it('should calculate installments for 1000 BOB / 3 installments / 5% weekly', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(5);

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: 3,
        startDate: new Date('2026-08-15T00:00:00.000Z'),
        periodType: PeriodType.WEEKLY,
      });

      expect(result.totalAmount.toNumber()).toBe(1150);
      expect(result.installments[0].totalAmount.toNumber()).toBe(383.33);
      expect(result.installments[1].totalAmount.toNumber()).toBe(383.33);
      expect(result.installments[2].totalAmount.toNumber()).toBe(383.34);

      const sumTotal = result.installments.reduce(
        (acc, inst) => acc.add(inst.totalAmount),
        Money.zero('BOB'),
      );
      expect(sumTotal.toNumber()).toBe(1150);
    });

    it('should absorb rounding in last installment for 7 installments / 15% weekly', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(15);

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: 7,
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        periodType: PeriodType.WEEKLY,
      });

      expect(result.installments).toHaveLength(7);

      const sumTotal = result.installments.reduce(
        (acc, inst) => acc.add(inst.totalAmount),
        Money.zero('BOB'),
      );
      expect(sumTotal.toNumber()).toBe(result.totalAmount.toNumber());

      const sumCapital = result.installments.reduce(
        (acc, inst) => acc.add(inst.capitalAmount),
        Money.zero('BOB'),
      );
      expect(sumCapital.toNumber()).toBe(capital.toNumber());
    });

    it('should auto-calculate firstDueDate as startDate + 1 month for MONTHLY', () => {
      const result = calculator.calculateInstallments({
        capital: Money.of(1000, 'BOB'),
        interestRate: new Decimal(10),
        totalInstallments: 3,
        startDate: new Date('2026-08-15T00:00:00.000Z'),
        periodType: PeriodType.MONTHLY,
      });

      // startDate=2026-08-15 → firstDueDate=2026-09-15
      expect(result.installments[0].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-15',
      );
      expect(result.installments[1].dueDate.toISOString().split('T')[0]).toBe(
        '2026-10-15',
      );
      expect(result.installments[2].dueDate.toISOString().split('T')[0]).toBe(
        '2026-11-15',
      );
    });

    it('should auto-calculate firstDueDate as startDate + 7 days for WEEKLY', () => {
      const result = calculator.calculateInstallments({
        capital: Money.of(500, 'BOB'),
        interestRate: new Decimal(5),
        totalInstallments: 2,
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        periodType: PeriodType.WEEKLY,
      });

      // startDate=2026-09-01 → firstDueDate=2026-09-08
      expect(result.installments[0].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-08',
      );
      expect(result.installments[1].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-15',
      );
    });

    it('should auto-calculate firstDueDate as startDate + 1 day for DAILY', () => {
      const result = calculator.calculateInstallments({
        capital: Money.of(100, 'BOB'),
        interestRate: new Decimal(2),
        totalInstallments: 2,
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        periodType: PeriodType.DAILY,
      });

      // startDate=2026-09-01 → firstDueDate=2026-09-02
      expect(result.installments[0].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-02',
      );
      expect(result.installments[1].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-03',
      );
    });

    it('should auto-calculate firstDueDate as startDate + 15 days for FORTNIGHTLY', () => {
      const result = calculator.calculateInstallments({
        capital: Money.of(1000, 'BOB'),
        interestRate: new Decimal(10),
        totalInstallments: 3,
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        periodType: PeriodType.FORTNIGHTLY,
      });

      // startDate=2026-09-01 → firstDueDate=2026-09-16
      expect(result.installments[0].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-16',
      );
      expect(result.installments[1].dueDate.toISOString().split('T')[0]).toBe(
        '2026-10-01',
      );
      expect(result.installments[2].dueDate.toISOString().split('T')[0]).toBe(
        '2026-10-16',
      );
    });
  });

  describe('calculateInterestOnlyInstallments()', () => {
    it('should calculate interest-only installments (1000 BOB / 3 installments / 10% monthly -> 100, 100, 1100)', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(10);

      const result = calculator.calculateInterestOnlyInstallments({
        capital,
        interestRate,
        totalInstallments: 3,
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        periodType: PeriodType.MONTHLY,
      });

      expect(result.totalAmount.toNumber()).toBe(1300);
      expect(result.installments).toHaveLength(3);

      // Cuota 1: capital=0, interés=100, total=100
      expect(result.installments[0].totalAmount.toNumber()).toBe(100.0);
      expect(result.installments[0].capitalAmount.toNumber()).toBe(0.0);
      expect(result.installments[0].interestAmount.toNumber()).toBe(100.0);

      // Cuota 2: capital=0, interés=100, total=100
      expect(result.installments[1].totalAmount.toNumber()).toBe(100.0);
      expect(result.installments[1].capitalAmount.toNumber()).toBe(0.0);
      expect(result.installments[1].interestAmount.toNumber()).toBe(100.0);

      // Cuota 3 (última): capital=1000, interés=100, total=1100
      expect(result.installments[2].totalAmount.toNumber()).toBe(1100.0);
      expect(result.installments[2].capitalAmount.toNumber()).toBe(1000.0);
      expect(result.installments[2].interestAmount.toNumber()).toBe(100.0);

      const sumTotal = result.installments.reduce(
        (acc, inst) => acc.add(inst.totalAmount),
        Money.zero('BOB'),
      );
      expect(sumTotal.toNumber()).toBe(1300);

      const sumCapital = result.installments.reduce(
        (acc, inst) => acc.add(inst.capitalAmount),
        Money.zero('BOB'),
      );
      expect(sumCapital.toNumber()).toBe(1000);
    });
  });

  describe('calculateDueDate()', () => {
    const baseDate = new Date('2026-09-01T00:00:00.000Z');

    it('should calculate daily due dates', () => {
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.DAILY, 0)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-01');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.DAILY, 1)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-02');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.DAILY, 5)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-06');
    });

    it('should calculate weekly due dates', () => {
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.WEEKLY, 0)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-01');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.WEEKLY, 1)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-08');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.WEEKLY, 2)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-15');
    });

    it('should calculate fortnightly due dates', () => {
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.FORTNIGHTLY, 0)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-01');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.FORTNIGHTLY, 1)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-16');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.FORTNIGHTLY, 2)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-10-01');
    });

    it('should calculate monthly due dates', () => {
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.MONTHLY, 0)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-09-01');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.MONTHLY, 1)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-10-01');
      expect(
        calculator
          .calculateDueDate(baseDate, PeriodType.MONTHLY, 3)
          .toISOString()
          .split('T')[0],
      ).toBe('2026-12-01');
    });
  });
});
