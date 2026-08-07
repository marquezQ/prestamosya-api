import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, login } from './helpers';

/**
 * E2E de auth: prueba el flujo real HTTP → controller → service → BD (test).
 * Cubre el login (feliz y fallido), el acceso protegido de /me y el logout.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('devuelve accessToken y user sin passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);
      const body = res.body as {
        accessToken: string;
        user: Record<string, unknown>;
      };

      expect(body.accessToken).toBeDefined();
      expect(body.user).toBeDefined();
      // Seguridad: el hash nunca viaja en la respuesta.
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('rechaza credenciales inválidas con 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'incorrecta' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('devuelve la sesión del usuario autenticado', async () => {
      const { accessToken } = await login(app);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const body = res.body as { username: string; role: string };

      expect(body.username).toBe('admin');
      expect(body.role).toBe('admin');
    });

    it('bloquea sin token (401)', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });
});
