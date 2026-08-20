import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, login } from './helpers';

interface GuaranteeResponse {
  id: string;
  clientId: string;
  type: string;
  description: string;
  estimatedValue: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * E2E de guarantees: CRUD real sobre la BD de test, soft delete,
 * aislamiento entre admins y el ciclo de vida AVAILABLE → IN_USE → AVAILABLE
 * al vincular/desvincular una garantía de un préstamo.
 */
describe('Guarantees (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let admin2Token: string;
  let clientId: string;
  let client2Id: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await login(app, 'admin', 'admin123')).accessToken;
    admin2Token = (await login(app, 'admin2', 'admin123')).accessToken;

    // Dos clientes propios del admin1 (para probar el chequeo de cliente).
    const unique = Date.now();
    const res1 = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Cliente E2E Garantías',
        phone: '70000444',
        idNumber: `E2EG${unique}`,
      })
      .expect(201);
    clientId = (res1.body as { data: { id: string } }).data.id;

    const res2 = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Cliente E2E Garantías 2',
        phone: '70000555',
        idNumber: `E2EG${unique}B`,
      })
      .expect(201);
    client2Id = (res2.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CRUD /api/guarantees', () => {
    let guaranteeId: string;

    it('POST sin token devuelve 401', async () => {
      await request(app.getHttpServer())
        .post('/api/guarantees')
        .send({
          clientId,
          type: 'VEHICLE',
          description: 'Moto marca X',
        })
        .expect(401);
    });

    it('POST crea una garantía con status AVAILABLE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/guarantees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          type: 'VEHICLE',
          description: 'Moto marca X, placa 1234',
          estimatedValue: 1500.5,
        })
        .expect(201);

      const body = res.body as {
        data: GuaranteeResponse;
        message: string;
      };
      expect(body.message).toBe('Guarantee created successfully');
      expect(body.data.clientId).toBe(clientId);
      expect(body.data.type).toBe('VEHICLE');
      expect(body.data.description).toBe('Moto marca X, placa 1234');
      expect(body.data.estimatedValue).toBe(1500.5);
      expect(body.data.status).toBe('AVAILABLE');
      guaranteeId = body.data.id;
    });

    it('POST con type inválido devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/api/guarantees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          type: 'AIRCRAFT',
          description: 'inválido',
        })
        .expect(400);
    });

    it('POST con clientId inexistente devuelve 404', async () => {
      await request(app.getHttpServer())
        .post('/api/guarantees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId: '00000000-0000-4000-8000-000000000000',
          type: 'OTHER',
          description: 'fantasma',
        })
        .expect(404);
    });

    it('POST con clientId de otro admin devuelve 404 (aislamiento)', async () => {
      const admin2Clients = await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${admin2Token}`)
        .expect(200);
      const foreignId = (admin2Clients.body as { data: Array<{ id: string }> })
        .data[0].id;

      await request(app.getHttpServer())
        .post('/api/guarantees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId: foreignId,
          type: 'OTHER',
          description: 'ajeno',
        })
        .expect(404);
    });

    it('GET ?clientId lista las garantías del cliente', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/guarantees?clientId=${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as { data: GuaranteeResponse[] };

      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.map((g) => g.id)).toContain(guaranteeId);
    });

    it('GET :id devuelve la garantía', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as { data: GuaranteeResponse };

      expect(body.data.id).toBe(guaranteeId);
      expect(body.data.type).toBe('VEHICLE');
    });

    it('PATCH actualiza solo los campos enviados', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Descripción actualizada' })
        .expect(200);
      const body = res.body as { data: GuaranteeResponse };

      expect(body.data.description).toBe('Descripción actualizada');
      // El resto de campos permanece intacto
      expect(body.data.type).toBe('VEHICLE');
      expect(body.data.estimatedValue).toBe(1500.5);
    });

    it('PATCH con estimatedValue null lo limpia', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ estimatedValue: null })
        .expect(200);
      const body = res.body as { data: GuaranteeResponse };

      expect(body.data.estimatedValue).toBeNull();
    });

    it('GET :id con garantía inexistente devuelve 404', async () => {
      await request(app.getHttpServer())
        .get('/api/guarantees/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('GET :id con token de otro admin devuelve 404 (aislamiento)', async () => {
      await request(app.getHttpServer())
        .get(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .expect(404);
    });

    it('DELETE hace soft delete: desaparece de la lista', async () => {
      await request(app.getHttpServer())
        .delete(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get(`/api/guarantees?clientId=${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = list.body as { data: GuaranteeResponse[] };

      expect(body.data.map((g) => g.id)).not.toContain(guaranteeId);
    });

    it('DELETE de una garantía ya eliminada devuelve 404', async () => {
      await request(app.getHttpServer())
        .delete(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Ciclo de vida vinculada a un préstamo', () => {
    let guaranteeId: string;
    let loanId: string;

    it('crea la garantía y el préstamo de soporte', async () => {
      const gRes = await request(app.getHttpServer())
        .post('/api/guarantees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          type: 'REAL_ESTATE',
          description: 'Terreno zona Sur',
          estimatedValue: 20000,
        })
        .expect(201);
      guaranteeId = (gRes.body as { data: GuaranteeResponse }).data.id;

      const lRes = await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          mode: 'automatic',
          capitalAmount: 1000,
          currency: 'BOB',
          interestRate: 10,
          periodType: 'monthly',
          totalInstallments: 3,
          startDate: '2026-08-20',
        })
        .expect(201);
      loanId = (lRes.body as { data: { id: string } }).data.id;
    });

    it('POST /loans/:id/guarantees vincula y pasa la garantía a IN_USE', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/loans/${loanId}/guarantees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ guaranteeId })
        .expect(201);

      const body = res.body as {
        data: {
          id: string;
          loanId: string;
          guaranteeId: string;
          status: string;
          guarantee: { id: string; status: string };
        };
      };
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.guaranteeId).toBe(guaranteeId);
      expect(body.data.guarantee.status).toBe('IN_USE');
    });

    it('POST con garantía de otro cliente devuelve 400', async () => {
      // Garantía para el cliente 2, intento vincularla al préstamo del cliente 1
      const gRes = await request(app.getHttpServer())
        .post('/api/guarantees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId: client2Id,
          type: 'FURNITURE',
          description: 'Garantía de otro cliente',
        })
        .expect(201);
      const foreignGuaranteeId = (gRes.body as { data: GuaranteeResponse }).data
        .id;

      await request(app.getHttpServer())
        .post(`/api/loans/${loanId}/guarantees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ guaranteeId: foreignGuaranteeId })
        .expect(400);
    });

    it('DELETE de una garantía IN_USE devuelve 400', async () => {
      await request(app.getHttpServer())
        .delete(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('DELETE /loans/:id/guarantees/:guaranteeId desvincula y vuelve a AVAILABLE', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/loans/${loanId}/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as { message: string };
      expect(body.message).toBe('Guarantee unlinked successfully');

      // La garantía vuelve a AVAILABLE y ahora sí se puede eliminar
      const detail = await request(app.getHttpServer())
        .get(`/api/loans/${loanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const detailBody = detail.body as { data: { guarantees: unknown[] } };
      expect(detailBody.data.guarantees).toEqual([]);

      await request(app.getHttpServer())
        .delete(`/api/guarantees/${guaranteeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
