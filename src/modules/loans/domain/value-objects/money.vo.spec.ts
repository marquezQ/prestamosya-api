import { Money } from './money.vo';
import { CurrencyMismatchError } from '../errors/loan-domain.errors';

describe('Money Value Object', () => {
  // ─── Factory ─────────────────────────────────────────────

  describe('of()', () => {
    it('should create Money from number with 2 decimal places', () => {
      const m = Money.of(1234.567, 'BOB');
      expect(m.toNumber()).toBe(1234.57); // ROUND_HALF_UP
      expect(m.currency).toBe('BOB');
    });

    it('should create Money from string', () => {
      const m = Money.of('100.10', 'USD');
      expect(m.toNumber()).toBe(100.1);
      expect(m.currency).toBe('USD');
    });

    it('should handle the classic 0.1 + 0.2 floating point problem', () => {
      const a = Money.of(0.1, 'BOB');
      const b = Money.of(0.2, 'BOB');
      const sum = a.add(b);
      expect(sum.toNumber()).toBe(0.3);
    });

    it('should round 0.005 up to 0.01', () => {
      const m = Money.of(0.005, 'BOB');
      expect(m.toNumber()).toBe(0.01);
    });
  });

  describe('zero()', () => {
    it('should create Money with zero amount', () => {
      const z = Money.zero('BOB');
      expect(z.isZero()).toBe(true);
      expect(z.toNumber()).toBe(0);
      expect(z.currency).toBe('BOB');
    });
  });

  // ─── Arithmetic ──────────────────────────────────────────

  describe('add()', () => {
    it('should add two Money of the same currency', () => {
      const a = Money.of(100.5, 'BOB');
      const b = Money.of(200.3, 'BOB');
      const result = a.add(b);
      expect(result.toNumber()).toBe(300.8);
      expect(result.currency).toBe('BOB');
    });

    it('should throw CurrencyMismatchError when adding different currencies', () => {
      const bob = Money.of(100, 'BOB');
      const usd = Money.of(50, 'USD');
      expect(() => bob.add(usd)).toThrow(CurrencyMismatchError);
    });
  });

  describe('subtract()', () => {
    it('should subtract two Money of the same currency', () => {
      const a = Money.of(500, 'BOB');
      const b = Money.of(123.45, 'BOB');
      const result = a.subtract(b);
      expect(result.toNumber()).toBe(376.55);
    });

    it('should throw CurrencyMismatchError when subtracting different currencies', () => {
      const bob = Money.of(100, 'BOB');
      const usd = Money.of(50, 'USD');
      expect(() => bob.subtract(usd)).toThrow(CurrencyMismatchError);
    });
  });

  describe('multiply()', () => {
    it('should multiply by a number factor', () => {
      const capital = Money.of(1000, 'BOB');
      const interest = capital.multiply(0.1);
      expect(interest.toNumber()).toBe(100);
    });

    it('should round the result to 2 decimal places', () => {
      const m = Money.of(100, 'BOB');
      const result = m.multiply(0.333);
      expect(result.toNumber()).toBe(33.3);
    });
  });

  describe('divide()', () => {
    it('should divide by a number', () => {
      const capital = Money.of(1000, 'BOB');
      const perInstallment = capital.divide(3);
      expect(perInstallment.toNumber()).toBe(333.33);
    });

    it('should divide evenly', () => {
      const capital = Money.of(900, 'BOB');
      const perInstallment = capital.divide(3);
      expect(perInstallment.toNumber()).toBe(300);
    });
  });

  // ─── Comparison ──────────────────────────────────────────

  describe('comparison methods', () => {
    it('isGreaterThan should work correctly', () => {
      const a = Money.of(100, 'BOB');
      const b = Money.of(50, 'BOB');
      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
    });

    it('isGreaterThanOrEqual should work correctly', () => {
      const a = Money.of(100, 'BOB');
      const b = Money.of(100, 'BOB');
      expect(a.isGreaterThanOrEqual(b)).toBe(true);
    });

    it('isLessThan should work correctly', () => {
      const a = Money.of(50, 'BOB');
      const b = Money.of(100, 'BOB');
      expect(a.isLessThan(b)).toBe(true);
    });

    it('comparison should throw on different currencies', () => {
      const bob = Money.of(100, 'BOB');
      const usd = Money.of(100, 'USD');
      expect(() => bob.isGreaterThan(usd)).toThrow(CurrencyMismatchError);
    });
  });

  describe('min()', () => {
    it('should return the smaller of two Money values', () => {
      const a = Money.of(100, 'BOB');
      const b = Money.of(50, 'BOB');
      expect(a.min(b).toNumber()).toBe(50);
      expect(b.min(a).toNumber()).toBe(50);
    });
  });

  // ─── Serialization ───────────────────────────────────────

  describe('toString()', () => {
    it('should return a fixed 2-decimal string for persistence', () => {
      const m = Money.of(1000, 'BOB');
      expect(m.toString()).toBe('1000.00');
    });

    it('should preserve decimals', () => {
      const m = Money.of(123.4, 'BOB');
      expect(m.toString()).toBe('123.40');
    });
  });

  describe('equals()', () => {
    it('should return true for equal amount and currency', () => {
      const a = Money.of(100, 'BOB');
      const b = Money.of(100, 'BOB');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different amounts', () => {
      const a = Money.of(100, 'BOB');
      const b = Money.of(200, 'BOB');
      expect(a.equals(b)).toBe(false);
    });

    it('should return false for different currencies', () => {
      const a = Money.of(100, 'BOB');
      const b = Money.of(100, 'USD');
      expect(a.equals(b)).toBe(false);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────

  describe('isNegative()', () => {
    it('should detect negative amounts', () => {
      const a = Money.of(50, 'BOB');
      const b = Money.of(100, 'BOB');
      const result = a.subtract(b);
      expect(result.isNegative()).toBe(true);
    });
  });
});
