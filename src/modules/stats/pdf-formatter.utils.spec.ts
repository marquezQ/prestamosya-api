import {
  computeDelayDays,
  fmt,
  fmtDateColumn,
  fmtRate,
  fmtShortDate,
  fmtTodayLaPaz,
  round,
  truncate,
} from './pdf-formatter.utils';

describe('pdf-formatter.utils', () => {
  describe('fmtDateColumn', () => {
    it('formatea fechas de base de datos (@db.Date a las 00:00:00 UTC) sin sufrir desfase por zona horaria UTC-4', () => {
      // Simula fecha de pago en DB (20 de Septiembre de 2026)
      const paymentDate = new Date('2026-09-20T00:00:00.000Z');
      expect(fmtDateColumn(paymentDate)).toBe('20/09/2026');

      // Simula fecha de vencimiento en DB (9 de Septiembre de 2026)
      const dueDate = new Date('2026-09-09T00:00:00.000Z');
      expect(fmtDateColumn(dueDate)).toBe('09/09/2026');
    });

    it('formatea strings de fecha ISO en UTC sin desplazamiento', () => {
      expect(fmtDateColumn('2026-09-20T00:00:00.000Z')).toBe('20/09/2026');
      expect(fmtDateColumn('2026-09-09T00:00:00.000Z')).toBe('09/09/2026');
    });
  });

  describe('fmtShortDate', () => {
    it('formatea instantes reales en la zona horaria de America/La_Paz', () => {
      // 20/09 00:00 UTC equivale a 19/09 20:00 en La Paz → día anterior
      expect(fmtShortDate('2026-09-20T00:00:00.000Z')).toBe('19/09/2026');
      // 20/09 04:00 UTC equivale a 20/09 00:00 en La Paz → mismo día
      expect(fmtShortDate('2026-09-20T04:00:00.000Z')).toBe('20/09/2026');
    });
  });

  describe('fmtTodayLaPaz', () => {
    it('retorna el día calendario de La Paz para un instante nocturno en UTC', () => {
      // 20/09 00:00 UTC = 19/09 20:00 La Paz → la fecha de "hoy" es 19/09
      const lateNightUtc = new Date('2026-09-20T00:00:00.000Z');
      expect(fmtTodayLaPaz(lateNightUtc)).toBe('19/09/2026');
    });

    it('retorna una fecha formateada válida en formato DD/MM/YYYY sin argumentos', () => {
      const todayStr = fmtTodayLaPaz();
      expect(todayStr).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  });

  describe('computeDelayDays', () => {
    it('calcula los días de retraso exactos usando UTC', () => {
      const dueDate = new Date('2026-09-09T00:00:00.000Z');
      const paymentDate = new Date('2026-09-20T00:00:00.000Z');

      expect(computeDelayDays(dueDate, paymentDate)).toBe(11);
    });

    it('retorna 0 si se pagó el mismo día o antes', () => {
      const dueDate = new Date('2026-09-20T00:00:00.000Z');
      const paymentDate = new Date('2026-09-20T00:00:00.000Z');
      expect(computeDelayDays(dueDate, paymentDate)).toBe(0);

      const earlyPaymentDate = new Date('2026-09-15T00:00:00.000Z');
      expect(computeDelayDays(dueDate, earlyPaymentDate)).toBe(0);
    });
  });

  describe('fmt', () => {
    it('formatea números con 2 decimales y separadores de miles', () => {
      expect(fmt(1950)).toBe('1.950,00');
      expect(fmt(1234.5)).toBe('1.234,50');
    });
  });

  describe('fmtRate', () => {
    it('formatea la tasa de interés con el tipo de período', () => {
      expect(fmtRate(10, 'monthly')).toBe('10% Mensual');
      expect(fmtRate(5, null)).toBe('5%');
    });
  });

  describe('truncate', () => {
    it('trunca un texto largo añadiendo puntos suspensivos', () => {
      expect(truncate('María Quispe Mamani', 10)).toBe('María Qui…');
      expect(truncate('Juan', 10)).toBe('Juan');
    });
  });

  describe('round', () => {
    it('redondea a exactamente 2 decimales', () => {
      expect(round(0.1 + 0.2)).toBe(0.3);
      expect(round(10.555)).toBe(10.56);
    });
  });
});
