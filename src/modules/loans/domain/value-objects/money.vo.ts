import Decimal from 'decimal.js';
import { CurrencyMismatchError } from '../errors/loan-domain.errors';

/**
 * Monedas soportadas por el sistema.
 * Definido aquí para no depender de los enums de Prisma.
 */
export type Currency = 'BOB' | 'USD';

/**
 * Value Object inmutable que encapsula un monto monetario con su moneda.
 *
 * Proporciona aritmética exacta vía Decimal.js y previene la mezcla
 * de monedas en tiempo de ejecución (Regla 9 de AGENT.md:
 * "Nunca mezclar monedas en un mismo cálculo financiero").
 *
 * Todos los montos se almacenan con exactamente 2 decimales.
 *
 * @example
 * ```typescript
 * const capital = Money.of(1000, 'BOB');
 * const interest = Money.of(100, 'BOB');
 * const total = capital.add(interest); // Money(1100.00, BOB)
 *
 * const usd = Money.of(50, 'USD');
 * capital.add(usd); // ⛔ throws CurrencyMismatchError
 * ```
 */
export class Money {
  private constructor(
    public readonly amount: Decimal,
    public readonly currency: Currency,
  ) {}

  /**
   * Crea una instancia de Money a partir de un valor numérico o string.
   * El monto se redondea a 2 decimales con ROUND_HALF_UP.
   */
  static of(amount: number | string | Decimal, currency: Currency): Money {
    const decimal = amount instanceof Decimal ? amount : new Decimal(amount);

    return new Money(
      decimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      currency,
    );
  }

  /** Crea un Money con monto cero. */
  static zero(currency: Currency): Money {
    return new Money(new Decimal(0), currency);
  }

  /** Suma dos montos de la misma moneda. */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amount.plus(other.amount), this.currency);
  }

  /** Resta otro monto de la misma moneda. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amount.minus(other.amount), this.currency);
  }

  /**
   * Multiplica el monto por un factor numérico.
   * Útil para calcular interés: `capital.multiply(rate)`.
   */
  multiply(factor: number | string | Decimal): Money {
    const factorDecimal =
      factor instanceof Decimal ? factor : new Decimal(factor);

    return Money.of(this.amount.mul(factorDecimal), this.currency);
  }

  /**
   * Divide el monto entre un divisor.
   * Útil para calcular capital por cuota: `capital.divide(totalInstallments)`.
   */
  divide(divisor: number | string | Decimal): Money {
    const divisorDecimal =
      divisor instanceof Decimal ? divisor : new Decimal(divisor);

    return Money.of(this.amount.div(divisorDecimal), this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.greaterThan(other.amount);
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.greaterThanOrEqualTo(other.amount);
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.lessThan(other.amount);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  /** Retorna el menor de los dos montos. */
  min(other: Money): Money {
    this.assertSameCurrency(other);
    return this.isLessThan(other) ? this : other;
  }

  /** Convierte a number para serialización a la API. */
  toNumber(): number {
    return this.amount.toNumber();
  }

  /** Convierte a string para persistencia en BD (mapper Prisma). */
  toString(): string {
    return this.amount.toFixed(2);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  /**
   * Valida que ambos montos tengan la misma moneda.
   * Previene errores silenciosos al operar BOB con USD.
   */
  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
