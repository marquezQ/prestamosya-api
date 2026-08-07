// Helpers reutilizables para las suites E2E: arrancan la app NestJS real
// con la misma configuración de main.ts (prefix /api + validación) y
// facilitan el login para obtener el Bearer token.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

export interface AuthTokens {
  accessToken: string;
}

// Hace login con las credenciales del seed y extrae el access token.
export async function login(
  app: INestApplication<App>,
  username = 'admin',
  password = 'admin123',
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);
  const body = res.body as { accessToken: string };
  return { accessToken: body.accessToken };
}
