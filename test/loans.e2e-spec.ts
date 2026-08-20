import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, login } from './helpers';

interface Installment {
  id: string | null;
  installmentNumber: number;
  dueDate: string;
  capitalAmount: string | number;
  interestAmount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  remainingAmount: string | number;
  status: string;
  daysOverdue: number;
  paidAt: string | null;
  archived: boolean;
}

interface CreateLoanResponse {
  data: {
    id: string;
    clientId: string;
    createdBy: string;
    mode: string;
    capitalAmount: string;
    currency: string;
    interestRate: number;
    periodType: string;
    totalInstallments: number;
    totalAmount: string;
    totalPaid: string;
    outstandingBalance: string;
    status: string;
    startDate: string;
    firstDueDate: string;
    notes: string | null;
    installments: Installment[];
  };
  message: string;
}

/**
 * E2E de loans: flujo completo sobre la BD de test real.
 * Verifica la creación automática y manual de préstamos (con la fórmula
 * flat-rate), la simulación, el detalle y las cuotas, además del
 * aislamiento entre admins y los errores de validación.
 */
describe('Loans (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let admin2Token: string;
  let clientId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await login(app, 'admin', 'admin123')).accessToken;
    admin2Token = (await login(app, 'admin2', 'admin123')).accessToken;

    // Cliente propio del admin1 para los préstamos de la suite.
    const res = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Cliente E2E Loans',
        phone: '70000333',
        idNumber: `E2EL${Date.now()}`,
      })
      .expect(201);
    clientId = (res.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function validLoanBody(overrides: Record<string, unknown> = {}) {
    return {
      clientId,
      mode: 'automatic',
      capitalAmount: 1000,
      currency: 'BOB',
      interestRate: 10,
      periodType: 'monthly',
      totalInstallments: 3,
      startDate: '2026-08-20',
      ...overrides,
    };
  }

  describe('Validación y errores', () => {
    it('POST sin token devuelve 401', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .send(validLoanBody())
        .expect(401);
    });

    it('POST con body vacío devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('POST con capitalAmount 0 devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validLoanBody({ capitalAmount: 0 }))
        .expect(400);
    });

    it('POST con currency inválida devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validLoanBody({ currency: 'EUR' }))
        .expect(400);
    });

    it('POST con clientId inexistente devuelve 404', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          validLoanBody({ clientId: '00000000-0000-4000-8000-000000000000' }),
        )
        .expect(404);
    });

    it('POST con clientId de otro admin devuelve 404 (aislamiento)', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send(validLoanBody())
        .expect(404);
    });

    it('POST automático sin periodType devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          validLoanBody({
            mode: 'automatic',
            periodType: undefined,
          }),
        )
        .expect(400);
    });

    it('POST manual sin manualInstallments devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validLoanBody({ mode: 'manual' }))
        .expect(400);
    });
  });

  describe('Creación automática', () => {
    let loanId: string;

    it('POST crea un préstamo con cuotas calculadas (fórmula flat-rate)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validLoanBody())
        .expect(201);

      const body = res.body as CreateLoanResponse;
      loanId = body.data.id;

      // Datos maestros del préstamo
      expect(body.data.mode).toBe('automatic');
      expect(body.data.capitalAmount).toBe('1000.00');
      expect(body.data.currency).toBe('BOB');
      expect(body.data.interestRate).toBe(10);
      expect(body.data.periodType).toBe('monthly');
      expect(body.data.totalInstallments).toBe(3);
      expect(body.data.totalAmount).toBe('1300.00');
      expect(body.data.totalPaid).toBe('0.00');
      expect(body.data.outstandingBalance).toBe('1300.00');
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.startDate).toBe('2026-08-20');
      // firstDueDate = startDate + 1 período (mensual → +1 mes)
      expect(body.data.firstDueDate).toBe('2026-09-20');

      // Cronograma: cuotas 433.33 / 433.33 / 433.34 (la última absorbe redondeo)
      expect(body.data.installments).toHaveLength(3);
      const totals = body.data.installments.map((i) => i.totalAmount);
      expect(totals).toEqual(['433.33', '433.33', '433.34']);
      expect(body.data.installments.map((i) => i.dueDate)).toEqual([
        '2026-09-20',
        '2026-10-20',
        '2026-11-20',
      ]);

      const last = body.data.installments[2];
      expect(last.capitalAmount).toBe('333.34');
      expect(last.interestAmount).toBe('100.00');
      expect(body.data.installments.every((i) => i.status === 'PENDING')).toBe(
        true,
      );
      expect(body.data.installments.every((i) => i.paidAmount === '0.00')).toBe(
        true,
      );
    });

    it('POST actualiza el status del cliente a CURRENT', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as {
        data: { client: { status: string } };
      };
      expect(body.data.client.status).toBe('CURRENT');
    });

    it('GET :id devuelve el detalle completo', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/loans/${loanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as {
        data: {
          loan: {
            id: string;
            clientName: string;
            capitalAmount: number;
            totalAmount: number;
            outstandingBalance: number;
            status: string;
          };
          installments: unknown[];
          guarantees: unknown[];
          payments: unknown[];
        };
      };

      expect(body.data.loan.id).toBe(loanId);
      expect(body.data.loan.clientName).toBe('Cliente E2E Loans');
      // En el detalle los montos son numbers
      expect(body.data.loan.capitalAmount).toBe(1000);
      expect(body.data.loan.totalAmount).toBe(1300);
      expect(body.data.loan.outstandingBalance).toBe(1300);
      expect(body.data.loan.status).toBe('ACTIVE');
      expect(body.data.installments).toHaveLength(3);
      expect(body.data.guarantees).toEqual([]);
      expect(body.data.payments).toEqual([]);
    });

    it('GET :id/installments devuelve solo las cuotas', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/loans/${loanId}/installments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as { data: Installment[] };

      expect(body.data).toHaveLength(3);
      expect(body.data[0].installmentNumber).toBe(1);
      expect(body.data[0].totalAmount).toBe(433.33);
      expect(body.data[0].remainingAmount).toBe(433.33);
    });

    it('GET :id con préstamo inexistente devuelve 404', async () => {
      await request(app.getHttpServer())
        .get('/api/loans/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('GET :id con token de otro admin devuelve 404 (aislamiento)', async () => {
      await request(app.getHttpServer())
        .get(`/api/loans/${loanId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .expect(404);
    });
  });

  describe('Simulación', () => {
    it('POST simulate devuelve el cálculo sin persistir', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/loans/simulate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capitalAmount: 1000,
          currency: 'BOB',
          interestRate: 10,
          periodType: 'monthly',
          totalInstallments: 3,
          startDate: '2026-08-20',
        })
        .expect(200);
      const body = res.body as {
        data: {
          capitalAmount: number;
          totalAmount: number;
          installments: Installment[];
        };
      };

      expect(body.data.capitalAmount).toBe(1000);
      expect(body.data.totalAmount).toBe(1300);
      expect(body.data.installments).toHaveLength(3);
      expect(body.data.installments.map((i) => i.totalAmount)).toEqual([
        '433.33',
        '433.33',
        '433.34',
      ]);
      // En simulación las cuotas no tienen id persistido
      expect(body.data.installments.every((i) => i.id === null)).toBe(true);
    });

    it('POST simulate con período quincenal adelanta 15 días por cuota', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/loans/simulate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capitalAmount: 1000,
          currency: 'BOB',
          interestRate: 10,
          periodType: 'fortnightly',
          totalInstallments: 3,
          startDate: '2026-08-20',
        })
        .expect(200);
      const body = res.body as { data: { installments: Installment[] } };

      expect(body.data.installments.map((i) => i.dueDate)).toEqual([
        '2026-09-04',
        '2026-09-19',
        '2026-10-04',
      ]);
    });
  });

  describe('Modo manual', () => {
    it('POST manual crea un préstamo con el cronograma enviado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          validLoanBody({
            mode: 'manual',
            capitalAmount: 500,
            periodType: undefined,
            totalInstallments: 2,
            manualInstallments: [
              {
                installmentNumber: 1,
                dueDate: '2026-09-01',
                capitalAmount: 250,
                interestAmount: 20,
                totalAmount: 270,
              },
              {
                installmentNumber: 2,
                dueDate: '2026-10-01',
                capitalAmount: 250,
                interestAmount: 20,
                totalAmount: 270,
              },
            ],
          }),
        )
        .expect(201);

      const body = res.body as CreateLoanResponse;
      expect(body.data.mode).toBe('manual');
      expect(body.data.totalAmount).toBe('540.00');
      // firstDueDate proviene de la primera cuota del cronograma manual
      expect(body.data.firstDueDate).toBe('2026-09-01');
      expect(body.data.installments).toHaveLength(2);
      expect(body.data.installments[0].totalAmount).toBe('270.00');
    });

    it('POST manual con length distinto a totalInstallments devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          validLoanBody({
            mode: 'manual',
            capitalAmount: 500,
            periodType: undefined,
            totalInstallments: 3,
            manualInstallments: [
              {
                installmentNumber: 1,
                dueDate: '2026-09-01',
                capitalAmount: 250,
                interestAmount: 20,
                totalAmount: 270,
              },
            ],
          }),
        )
        .expect(400);
    });

    it('POST manual con total menor al capital devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          validLoanBody({
            mode: 'manual',
            capitalAmount: 1000,
            periodType: undefined,
            totalInstallments: 2,
            manualInstallments: [
              {
                installmentNumber: 1,
                dueDate: '2026-09-01',
                capitalAmount: 300,
                interestAmount: 20,
                totalAmount: 320,
              },
              {
                installmentNumber: 2,
                dueDate: '2026-10-01',
                capitalAmount: 300,
                interestAmount: 20,
                totalAmount: 320,
              },
            ],
          }),
        )
        .expect(400);
    });
  });
});
