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
    it('should calculate installments for 1000 BOB / 3 installments / 10% monthly interest rate', () => {
      // Ejemplo exacto de la especificación:
      // Capital: 1000 BOB
      // Tasa: 10%
      // Plazo: 3 cuotas
      // Interés total: 1000 * 0.10 * 3 = 300
      // Total: 1300
      // Cuotas: 1300 / 3 -> 433.33, 433.33, 433.34
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(10);
      const totalInstallments = 3;
      const firstDueDate = new Date('2026-09-01T00:00:00.000Z');

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments,
        firstDueDate,
        periodType: PeriodType.MONTHLY,
      });

      expect(result.totalAmount.toNumber()).toBe(1300);
      expect(result.installments).toHaveLength(3);

      // Cuota 1: 433.33 (333.33 capital + 100.00 interés)
      expect(result.installments[0].totalAmount.toNumber()).toBe(433.33);
      expect(result.installments[0].capitalAmount.toNumber()).toBe(333.33);
      expect(result.installments[0].interestAmount.toNumber()).toBe(100.0);

      // Cuota 2: 433.33 (333.33 capital + 100.00 interés)
      expect(result.installments[1].totalAmount.toNumber()).toBe(433.33);
      expect(result.installments[1].capitalAmount.toNumber()).toBe(333.33);
      expect(result.installments[1].interestAmount.toNumber()).toBe(100.0);

      // Cuota 3 (última absorbe diferencia):
      // Total acumulado cuotas 1 y 2 = 866.66 -> Restante: 1300 - 866.66 = 433.34
      // Capital restante: 1000 - 666.66 = 333.34
      // Interés restante: 300 - 200 = 100.00
      expect(result.installments[2].totalAmount.toNumber()).toBe(433.34);
      expect(result.installments[2].capitalAmount.toNumber()).toBe(333.34);
      expect(result.installments[2].interestAmount.toNumber()).toBe(100.0);

      // Verificación de invariantes: las sumas coinciden exactamente con los totales
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

    it('should calculate installments for 1000 BOB / 3 installments / 5% biweekly/quincenal rate (Example 2)', () => {
      // Ejemplo quincenal de la especificación:
      // Capital: 1000 BOB
      // Tasa: 5%
      // Plazo: 3 quincenas
      // Interés: 1000 * 5% * 3 = 150
      // Total: 1150
      // Cuotas: 1150 / 3 -> 383.33, 383.33, 383.34
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(5);
      const totalInstallments = 3;
      const firstDueDate = new Date('2026-09-01T00:00:00.000Z');

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments,
        firstDueDate,
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

    it('should calculate installments for 1000 BOB / 7 installments / 15% rate and absorb rounding in last installment', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(15);
      const totalInstallments = 7;
      const firstDueDate = new Date('2026-09-01T00:00:00.000Z');

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments,
        firstDueDate,
        periodType: PeriodType.WEEKLY,
      });

      expect(result.installments).toHaveLength(7);

      // Sum of all installments must equal totalAmount exactly
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
  });

  describe('calculateDueDate()', () => {
    const baseDate = new Date('2026-09-01T00:00:00.000Z');

    it('should calculate daily due dates', () => {
      const offset0 = calculator.calculateDueDate(
        baseDate,
        PeriodType.DAILY,
        0,
      );
      const offset1 = calculator.calculateDueDate(
        baseDate,
        PeriodType.DAILY,
        1,
      );
      const offset5 = calculator.calculateDueDate(
        baseDate,
        PeriodType.DAILY,
        5,
      );

      expect(offset0.toISOString().split('T')[0]).toBe('2026-09-01');
      expect(offset1.toISOString().split('T')[0]).toBe('2026-09-02');
      expect(offset5.toISOString().split('T')[0]).toBe('2026-09-06');
    });

    it('should calculate weekly due dates', () => {
      const offset0 = calculator.calculateDueDate(
        baseDate,
        PeriodType.WEEKLY,
        0,
      );
      const offset1 = calculator.calculateDueDate(
        baseDate,
        PeriodType.WEEKLY,
        1,
      );
      const offset2 = calculator.calculateDueDate(
        baseDate,
        PeriodType.WEEKLY,
        2,
      );

      expect(offset0.toISOString().split('T')[0]).toBe('2026-09-01');
      expect(offset1.toISOString().split('T')[0]).toBe('2026-09-08');
      expect(offset2.toISOString().split('T')[0]).toBe('2026-09-15');
    });

    it('should calculate monthly due dates', () => {
      const offset0 = calculator.calculateDueDate(
        baseDate,
        PeriodType.MONTHLY,
        0,
      );
      const offset1 = calculator.calculateDueDate(
        baseDate,
        PeriodType.MONTHLY,
        1,
      );
      const offset3 = calculator.calculateDueDate(
        baseDate,
        PeriodType.MONTHLY,
        3,
      );

      expect(offset0.toISOString().split('T')[0]).toBe('2026-09-01');
      expect(offset1.toISOString().split('T')[0]).toBe('2026-10-01');
      expect(offset3.toISOString().split('T')[0]).toBe('2026-12-01');
    });
  });

  describe('calculateInstallments() with auto-calculated firstDueDate', () => {
    it('should auto-calculate firstDueDate as startDate + 1 month when firstDueDate is omitted', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(10);
      const startDate = new Date('2026-08-15T00:00:00.000Z');

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: 3,
        startDate,
        periodType: PeriodType.MONTHLY,
      });

      expect(result.installments).toHaveLength(3);
      // firstDueDate = startDate (2026-08-15) + 1 mes = 2026-09-15
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
      const capital = Money.of(500, 'BOB');
      const interestRate = new Decimal(5);
      const startDate = new Date('2026-09-01T00:00:00.000Z');

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: 2,
        startDate,
        periodType: PeriodType.WEEKLY,
      });

      // firstDueDate = 2026-09-01 + 7 días = 2026-09-08
      expect(result.installments[0].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-08',
      );
      expect(result.installments[1].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-15',
      );
    });

    it('should auto-calculate firstDueDate as startDate + 1 day for DAILY', () => {
      const capital = Money.of(100, 'BOB');
      const interestRate = new Decimal(2);
      const startDate = new Date('2026-09-01T00:00:00.000Z');

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: 2,
        startDate,
        periodType: PeriodType.DAILY,
      });

      // firstDueDate = 2026-09-01 + 1 día = 2026-09-02
      expect(result.installments[0].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-02',
      );
      expect(result.installments[1].dueDate.toISOString().split('T')[0]).toBe(
        '2026-09-03',
      );
    });

    it('should throw when neither firstDueDate nor startDate is provided', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(10);

      expect(() =>
        calculator.calculateInstallments({
          capital,
          interestRate,
          totalInstallments: 3,
          periodType: PeriodType.MONTHLY,
        }),
      ).toThrow('Se requiere firstDueDate o startDate');
    });

    it('should prefer firstDueDate over startDate when both are provided', () => {
      const capital = Money.of(1000, 'BOB');
      const interestRate = new Decimal(10);
      const startDate = new Date('2026-08-15T00:00:00.000Z');
      const firstDueDate = new Date('2026-12-01T00:00:00.000Z');

      const result = calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: 2,
        startDate,
        firstDueDate,
        periodType: PeriodType.MONTHLY,
      });

      // Se usa firstDueDate explícita, no startDate
      expect(result.installments[0].dueDate.toISOString().split('T')[0]).toBe(
        '2026-12-01',
      );
      expect(result.installments[1].dueDate.toISOString().split('T')[0]).toBe(
        '2027-01-01',
      );
    });
  });
});
