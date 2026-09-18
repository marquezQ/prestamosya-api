import { PaymentRow, RowTotals } from './pdf-builder.types';

// ─── Mapeo de modalidades de pago ─────────────────────────────────────────────

const PERIOD_LABEL: Record<string, string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  fortnightly: 'Quincenal',
  monthly: 'Mensual',
  custom: 'Manual',
};

// ─── Funciones de formato (puras y testeables de forma independiente) ─────────

/**
 * Formatea un número con 2 decimales y separadores de miles en locale boliviano.
 * @example fmt(1234.5) → "1.234,50"
 */
export function fmt(value: number): string {
  return value.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formatea la tasa de interés y modalidad de un préstamo.
 * @example fmtRate(10, 'monthly') → "10% Mensual"
 * @example fmtRate(5, null)       → "5%"
 */
export function fmtRate(rate: number, period: string | null): string {
  const label = period ? (PERIOD_LABEL[period] ?? period) : '';
  return `${rate}% ${label}`.trim();
}

/**
 * Trunca un texto largo añadiendo '…' para que quepa en una celda de tabla.
 * @example truncate("Nombre muy largo de cliente", 22) → "Nombre muy largo de cl…"
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + '…';
}

/**
 * Redondea un número a exactamente 2 decimales.
 * Evita errores de punto flotante en acumulaciones sucesivas.
 * @example round(0.1 + 0.2) → 0.30 (en lugar de 0.30000000000000004)
 */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula los totales financieros acumulados de un conjunto de filas de pago.
 * Función pura: sin efectos secundarios ni dependencias externas.
 */
export function computeTotals(rows: PaymentRow[]): RowTotals {
  return rows.reduce<RowTotals>(
    (acc, row) => ({
      amountPaid: round(acc.amountPaid + row.amountPaid),
      capitalPaid: round(acc.capitalPaid + row.capitalPaid),
      interestPaid: round(acc.interestPaid + row.interestPaid),
    }),
    { amountPaid: 0, capitalPaid: 0, interestPaid: 0 },
  );
}

/**
 * Formatea cualquier fecha a DD/MM/YYYY en zona horaria America/La_Paz.
 */
export function fmtShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/La_Paz',
  });
}

/**
 * Calcula los días enteros de retraso entre la fecha de vencimiento y la fecha de pago.
 * Si se pagó el mismo día o antes, retorna 0.
 */
export function computeDelayDays(dueDate: Date, paymentDate: Date): number {
  const due = new Date(dueDate).setHours(0, 0, 0, 0);
  const paid = new Date(paymentDate).setHours(0, 0, 0, 0);
  const diffMs = paid - due;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Formatea la fecha actual en formato DD/MM/YYYY para la zona horaria de La Paz.
 */
export function fmtTodayLaPaz(): string {
  return fmtShortDate(new Date());
}
