/**
 * Utilidades para manejo seguro de fechas y zonas horarias (America/La_Paz UTC-4).
 */

export const LA_PAZ_TIMEZONE = 'America/La_Paz';

/**
 * Retorna una instancia de Date correspondiente al inicio del día (00:00:00.000)
 * en la zona horaria dada (por defecto America/La_Paz).
 */
export function getTodayLaPaz(referenceDate: Date = new Date()): Date {
  const dateStr = referenceDate.toLocaleDateString('en-CA', {
    timeZone: LA_PAZ_TIMEZONE,
  }); // Retorna "YYYY-MM-DD"
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Retorna el inicio del día (00:00:00.000) en UTC para una fecha dada.
 */
export function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Resta una cantidad de días a una fecha dada.
 */
export function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

/**
 * Calcula la diferencia en días entre dos fechas (toDate - fromDate).
 * Retorna un número entero >= 0. Si toDate es menor que fromDate, retorna 0.
 */
export function calculateDaysOverdue(
  dueDate: Date,
  referenceDate: Date = new Date(),
): DateDaysOverdueResult {
  const due = getStartOfDay(dueDate);
  const ref = getStartOfDay(referenceDate);

  const diffMs = ref.getTime() - due.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    daysOverdue: Math.max(0, days),
    isPastDue: days > 0,
  };
}

export interface DateDaysOverdueResult {
  daysOverdue: number;
  isPastDue: boolean;
}
