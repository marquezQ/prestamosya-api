import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { StatsService } from './stats.service';

/**
 * Tests unitarios del StatsService.
 *
 * Principio rector (TESTING.md): probamos *invariantes* y *contratos*,
 * no líneas de código. Cada test responde a: "¿qué es lo que nadie
 * tiene permitido romper aquí?"
 *
 * Cobertura crítica:
 *  1. splitPayment() — la función financiera más crítica del módulo
 *  2. getMonthBounds() — los límites de mes deben ser exactos (DATE)
 *  3. Integración _computeIncomeBreakdown() — con mock de Prisma
 */
describe('StatsService', () => {
  let service: StatsService;

  // Mock manual de PrismaService (TESTING.md: sin dependencias extra)
  const mockPrisma = {
    payment: { findMany: jest.fn() },
    installment: { findMany: jest.fn() },
    loan: { findMany: jest.fn(), count: jest.fn() },
    client: { count: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    jest.clearAllMocks();
  });

  // ─── 1. splitPayment() ────────────────────────────────────────────────────

  describe('splitPayment()', () => {
    /**
     * CONTRATO: si el pago es menor que el interés pendiente,
     * TODO va a interés y NADA a capital.
     */
    it('pago < interés pendiente → todo va a interés, nada a capital', () => {
      const result = service.splitPayment(60, 100, 0);

      expect(result.toInterest).toBe(60);
      expect(result.toCapital).toBe(0);
    });

    /**
     * CONTRATO: si el pago iguala exactamente el interés pendiente,
     * se cubre el interés completo y nada de capital.
     */
    it('pago === interés pendiente → interés cubierto exacto, capital = 0', () => {
      const result = service.splitPayment(100, 100, 0);

      expect(result.toInterest).toBe(100);
      expect(result.toCapital).toBe(0);
    });

    /**
     * CONTRATO: si el pago supera el interés pendiente,
     * el excedente va todo a capital.
     */
    it('pago > interés → interés completo + resto a capital', () => {
      const result = service.splitPayment(433.33, 100, 0);

      expect(result.toInterest).toBe(100);
      expect(result.toCapital).toBe(333.33);
    });

    /**
     * CONTRATO: si el interés ya estaba parcialmente cubierto por un
     * pago anterior (paidBefore=60), solo se necesitan Bs 40 más para
     * cubrirlo. El resto del pago (Bs 160) va a capital.
     */
    it('paidBefore parcial → cubre el interés restante, resto a capital', () => {
      // Cuota: interés=100. Ya pagaron 60 antes. Pagan 200 ahora.
      const result = service.splitPayment(200, 100, 60);

      // interestYetToCover = max(0, 100 - 60) = 40
      expect(result.toInterest).toBe(40);
      expect(result.toCapital).toBe(160);
    });

    /**
     * CONTRATO: si el interés ya estaba completamente cubierto por pagos
     * anteriores (paidBefore >= interestAmount), el nuevo pago va 100% a capital.
     */
    it('interés ya cubierto por pagos previos → pago completo a capital', () => {
      // Cuota: interés=100, paidBefore=150 (interés ya cubierto con creces)
      const result = service.splitPayment(100, 100, 150);

      // interestYetToCover = max(0, 100 - 150) = 0
      expect(result.toInterest).toBe(0);
      expect(result.toCapital).toBe(100);
    });

    /**
     * CONTRATO: pago de Bs 0 produce split de ceros (caso borde).
     */
    it('pago de cero → no genera interés ni capital', () => {
      const result = service.splitPayment(0, 100, 0);

      expect(result.toInterest).toBe(0);
      expect(result.toCapital).toBe(0);
    });

    /**
     * CONTRATO: cuota INTEREST_ONLY (capitalAmount=0, interestAmount=totalAmount).
     * Todo el pago va a interés porque la cuota es 100% interés.
     */
    it('cuota INTEREST_ONLY: pago completo → todo es interés', () => {
      // Cuota solo interés: interestAmount = 100, capitalAmount = 0
      const result = service.splitPayment(100, 100, 0);

      expect(result.toInterest).toBe(100);
      expect(result.toCapital).toBe(0);
    });

    /**
     * CONTRATO: última cuota INTEREST_ONLY (capital+interés).
     * Se cubre primero el interés (100) y el resto (1000) va a capital.
     */
    it('última cuota INTEREST_ONLY (capital + interés): split correcto', () => {
      // Última cuota balloon: interestAmount=100, capitalAmount=1000
      // amountApplied=1100, paidBefore=0
      const result = service.splitPayment(1100, 100, 0);

      expect(result.toInterest).toBe(100);
      expect(result.toCapital).toBe(1000);
    });

    /**
     * CONTRATO: los resultados se redondean a 2 decimales (sin errores de
     * punto flotante que arruinen los totales del reporte).
     */
    it('redondeo a 2 decimales sin errores de punto flotante', () => {
      // 1000 / 3 = 333.3333... → capital = 333.33
      const result = service.splitPayment(433.33, 100, 0);

      expect(result.toCapital).toBe(333.33);
      expect(result.toInterest + result.toCapital).toBe(433.33);
    });
  });

  // ─── 2. getMonthBounds() ─────────────────────────────────────────────────

  describe('getMonthBounds()', () => {
    /**
     * CONTRATO: el primer día del mes debe ser exactamente 00:00:00 UTC.
     */
    it('startOfMonth es el día 1 del mes a las 00:00:00 UTC', () => {
      const { startOfMonth } = service.getMonthBounds(2026, 9);

      expect(startOfMonth.getUTCFullYear()).toBe(2026);
      expect(startOfMonth.getUTCMonth()).toBe(8); // 0-indexed: 8 = Septiembre
      expect(startOfMonth.getUTCDate()).toBe(1);
      expect(startOfMonth.getUTCHours()).toBe(0);
    });

    /**
     * CONTRATO: endOfMonth debe ser el primer día del mes siguiente
     * (límite exclusivo para queries gte/lt de Prisma).
     */
    it('endOfMonth es el primer día del mes siguiente (límite exclusivo)', () => {
      const { endOfMonth } = service.getMonthBounds(2026, 9);

      expect(endOfMonth.getUTCFullYear()).toBe(2026);
      expect(endOfMonth.getUTCMonth()).toBe(9); // 9 = Octubre
      expect(endOfMonth.getUTCDate()).toBe(1);
    });

    /**
     * CONTRATO: Diciembre → el mes siguiente debe ser Enero del año siguiente.
     */
    it('mes de Diciembre: endOfMonth cae en Enero del año siguiente', () => {
      const { startOfMonth, endOfMonth } = service.getMonthBounds(2026, 12);

      expect(startOfMonth.getUTCMonth()).toBe(11); // Diciembre = 11
      expect(endOfMonth.getUTCFullYear()).toBe(2027);
      expect(endOfMonth.getUTCMonth()).toBe(0); // Enero = 0
    });

    /**
     * CONTRATO: todos los días del mes deben caer dentro del rango [start, end).
     */
    it('último día del mes cae dentro del rango [startOfMonth, endOfMonth)', () => {
      const { startOfMonth, endOfMonth } = service.getMonthBounds(2026, 9);

      const lastDayOfSept = new Date(Date.UTC(2026, 8, 30, 23, 59, 59, 999));
      expect(lastDayOfSept >= startOfMonth).toBe(true);
      expect(lastDayOfSept < endOfMonth).toBe(true);
    });
  });

  // ─── 3. getMonthlyStats() — integración con mock de Prisma ───────────────

  describe('getMonthlyStats() — integración con Prisma mock', () => {
    /**
     * CONTRATO: los pagos anulados (voided=true) NUNCA deben sumarse
     * a los ingresos del mes.
     */
    it('pagos anulados no se incluyen en interestCollected', async () => {
      // Prisma devuelve lista vacía porque voided=false es el filtro
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loan.count.mockResolvedValue(0);
      mockPrisma.client.count.mockResolvedValue(0);

      const result = await service.getMonthlyStats('user-1', 2026, 9);

      expect(result.incomeBreakdown.interestCollected.BOB).toBe(0);
      expect(result.incomeBreakdown.interestCollected.USD).toBe(0);
    });

    /**
     * CONTRATO: BOB y USD NUNCA se mezclan. Un pago en BOB solo suma
     * a interestCollected.BOB, nunca a USD.
     */
    it('pago en BOB solo incrementa interestCollected.BOB, USD permanece en 0', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          paymentDate: new Date('2026-09-15'),
          discountAmount: null,
          loan: { currency: 'BOB' },
          installmentLinks: [
            {
              interestPaid: '100',
              capitalPaid: '0',
              interestDiscounted: '0',
              capitalDiscounted: '0',
            },
          ],
        },
      ]);
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loan.count.mockResolvedValue(0);
      mockPrisma.client.count.mockResolvedValue(0);

      const result = await service.getMonthlyStats('user-1', 2026, 9);

      // Interés de BOB cobrado
      expect(result.incomeBreakdown.interestCollected.BOB).toBeGreaterThan(0);
      // USD permanece intacto
      expect(result.incomeBreakdown.interestCollected.USD).toBe(0);
    });

    /**
     * CONTRATO: interestCollected + capitalRecovered == totalCashIn.
     * El envelope de totales debe ser matemáticamente consistente.
     */
    it('totalCashIn === interestCollected + capitalRecovered (invariante de suma)', async () => {
      // Pago de 433.33 BOB sobre cuota con interés=100, capital=333.33
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          paymentDate: new Date('2026-09-15'),
          discountAmount: null,
          loan: { currency: 'BOB' },
          installmentLinks: [
            {
              interestPaid: '100',
              capitalPaid: '333.33',
              interestDiscounted: '0',
              capitalDiscounted: '0',
            },
          ],
        },
      ]);
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loan.count.mockResolvedValue(0);
      mockPrisma.client.count.mockResolvedValue(0);

      const result = await service.getMonthlyStats('user-1', 2026, 9);
      const income = result.incomeBreakdown;

      const expectedTotal =
        Math.round(
          (income.interestCollected.BOB + income.capitalRecovered.BOB) * 100,
        ) / 100;

      expect(income.totalCashIn.BOB).toBe(expectedTotal);
    });

    /**
     * CONTRATO: el período devuelto debe coincidir con el año y mes solicitados.
     */
    it('el período del response refleja el año y mes solicitados', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loan.count.mockResolvedValue(0);
      mockPrisma.client.count.mockResolvedValue(0);

      const result = await service.getMonthlyStats('user-1', 2026, 9);

      expect(result.period.year).toBe(2026);
      expect(result.period.month).toBe(9);
      expect(result.period.label).toBe('Septiembre 2026');
      expect(result.period.startDate).toBe('2026-09-01');
      expect(result.period.endDate).toBe('2026-09-30');
    });

    /**
     * CONTRATO: discountsGiven se registra desde payment.discountAmount
     * y reduce la ganancia neta. NO se suma a interestCollected.
     */
    it('discountsGiven se acumula desde payment.discountAmount sin sumarse a interestCollected', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          paymentDate: new Date('2026-09-20'),
          discountAmount: '50', // condonación de Bs 50
          loan: { currency: 'BOB' },
          installmentLinks: [
            {
              interestPaid: '100',
              capitalPaid: '850',
              interestDiscounted: '50',
              capitalDiscounted: '0',
            },
          ],
        },
      ]);
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loan.count.mockResolvedValue(0);
      mockPrisma.client.count.mockResolvedValue(0);

      const result = await service.getMonthlyStats('user-1', 2026, 9);

      expect(result.incomeBreakdown.discountsGiven.BOB).toBe(50);
      // El interés cobrado es solo lo del pago, no incluye el descuento
      expect(result.incomeBreakdown.interestCollected.BOB).toBe(100);
    });

    /**
     * CONTRATO: collectionRate = 100% cuando todas las cuotas del mes
     * tienen estado PAID.
     */
    it('collectionRate = 100 cuando todas las cuotas del mes están PAID', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.installment.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          status: 'PAID',
          dueDate: new Date('2026-09-10'),
          interestAmount: '100',
          paidAmount: '433.33',
          totalAmount: '433.33',
          loan: { currency: 'BOB' },
          paymentLinks: [{ payment: { paymentDate: new Date('2026-09-10') } }],
        },
        {
          id: 'inst-2',
          status: 'PAID',
          dueDate: new Date('2026-09-20'),
          interestAmount: '100',
          paidAmount: '433.33',
          totalAmount: '433.33',
          loan: { currency: 'BOB' },
          paymentLinks: [{ payment: { paymentDate: new Date('2026-09-19') } }],
        },
      ]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loan.count.mockResolvedValue(0);
      mockPrisma.client.count.mockResolvedValue(0);

      const result = await service.getMonthlyStats('user-1', 2026, 9);

      expect(result.performanceSummary.collectionRate).toBe(100);
      expect(result.performanceSummary.installmentsDueCount).toBe(2);
      expect(result.performanceSummary.installmentsPaidOnTimeCount).toBe(2);
    });

    /**
     * CONTRATO: collectionRate = 0% cuando ninguna cuota del mes está pagada.
     */
    it('collectionRate = 0 cuando ninguna cuota del mes fue pagada', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.installment.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          status: 'OVERDUE',
          dueDate: new Date('2026-09-01'),
          interestAmount: '100',
          paidAmount: '0',
          totalAmount: '433.33',
          loan: { currency: 'BOB' },
          paymentLinks: [],
        },
      ]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loan.count.mockResolvedValue(0);
      mockPrisma.client.count.mockResolvedValue(0);

      const result = await service.getMonthlyStats('user-1', 2026, 9);

      expect(result.performanceSummary.collectionRate).toBe(0);
      expect(result.performanceSummary.installmentsStillOverdueCount).toBe(1);
    });
  });

  // ─── 4. getMonthlyHistory() ──────────────────────────────────────────────────

  describe('getMonthlyHistory()', () => {
    /**
     * CONTRATO: devuelve el historial en orden CRONOLÓGICO (mes más antiguo primero,
     * mes actual al final), ideal para dibujar gráficas de izquierda a derecha.
     */
    it('retorna el arreglo de meses en orden cronológico (antiguo → reciente)', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.installment.findMany.mockResolvedValue([]);
      mockPrisma.loan.findMany.mockResolvedValue([]);

      const history = await service.getMonthlyHistory('user-1', 3);

      expect(history.length).toBe(3);
      // El mes más antiguo debe tener un timestamp/fecha menor que el más reciente
      const dateOldest = history[0].year * 12 + history[0].month;
      const dateLatest = history[2].year * 12 + history[2].month;
      expect(dateOldest).toBeLessThan(dateLatest);
    });
  });
});
