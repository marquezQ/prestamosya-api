import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, login } from './helpers';

/**
 * E2E de clients: CRUD real sobre la BD de test. Verifica el soft delete
 * (el cliente desaparece de la lista) y el aislamiento entre admins
 * (un admin no ve ni modifica clientes de otro).
 */
describe('Clients (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let admin2Token: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await login(app, 'admin', 'admin123')).accessToken;
    admin2Token = (await login(app, 'admin2', 'admin123')).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CRUD /api/clients', () => {
    let clientId: string;
    // idNumber único por corrida: el CI es @unique, evita 409 en re-ejecuciones.
    const uniqueIdNumber = `E2E-${Date.now()}`;

    it('POST crea un cliente', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Cliente E2E',
          phone: '70000111',
          idNumber: uniqueIdNumber,
        })
        .expect(201);
      const body = res.body as { data: { fullName: string; id: string } };

      expect(body.data.fullName).toBe('Cliente E2E');
      clientId = body.data.id;
    });

    it('GET lista los clientes del admin autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as { data: Array<{ id: string }> };

      expect(body.data.length).toBeGreaterThan(0);
    });

    it('GET :id devuelve el perfil con el resumen financiero', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as {
        data: { client: { fullName: string }; financialSummary: unknown };
      };

      expect(body.data.client.fullName).toBe('Cliente E2E');
      // Perfil con las colecciones de datos esperadas.
      expect(body.data.financialSummary).toBeDefined();
    });

    it('PATCH actualiza un cliente', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phone: '70000222' })
        .expect(200);
      const body = res.body as { data: { phone: string } };

      expect(body.data.phone).toBe('70000222');
    });

    it('DELETE hace soft delete: deja de aparecer en la lista', async () => {
      await request(app.getHttpServer())
        .delete(`/api/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = list.body as { data: Array<{ id: string }> };

      const ids = body.data.map((c) => c.id);
      expect(ids).not.toContain(clientId);
    });
  });

  describe('Aislamiento entre admins', () => {
    it('GET :id no expone clientes de otro admin (404)', async () => {
      // El seed crea clientes del admin2; su primer cliente es de otro admin.
      const admin2Clients = await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${admin2Token}`)
        .expect(200);
      const body = admin2Clients.body as { data: Array<{ id: string }> };

      expect(body.data.length).toBeGreaterThan(0);
      const foreignId = body.data[0].id;

      await request(app.getHttpServer())
        .get(`/api/clients/${foreignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
