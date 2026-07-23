import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Prefijo global de la API ────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors();

  // ─── Validación global de DTOs ───────────────────────────────────────────
  // whitelist: strip propiedades no definidas en el DTO
  // forbidNonWhitelisted: lanza 400 si el cliente manda propiedades extras
  // transform: convierte los valores al tipo TypeScript declarado en el DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Swagger / OpenAPI ────────────────────────────────────────────────────
  // UI navegable en: GET /api
  // JSON importable en Postman en: GET /api-json
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PrestApp API')
    .setDescription(
      'API de PrestApp — Sistema de gestión de préstamos personales.\n\n' +
        '**Cómo probar en Postman:**\n' +
        '1. Importar → Link → `http://localhost:3000/api-json`\n' +
        '2. Ejecutar `POST /api/auth/login` con las credenciales del seed\n' +
        '3. Copiar el `accessToken` y usarlo como Bearer Token en los demás endpoints',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Pegar el accessToken obtenido de POST /api/auth/login',
      },
      'access-token', // nombre de referencia para @ApiBearerAuth('access-token')
    )
    .build();

  const document: OpenAPIObject = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  // Seguridad global: todas las rutas requieren Bearer Token por defecto
  document.security = [{ 'access-token': [] }];

  // Excluir el endpoint público de login de la seguridad global
  if (document.paths['/auth/login']?.post) {
    document.paths['/auth/login'].post.security = [];
  }

  SwaggerModule.setup('api', app, document, {
    jsonDocumentUrl: 'api-json',
    swaggerOptions: {
      persistAuthorization: true, // el token se recuerda al refrescar la página
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 PrestApp API corriendo en http://localhost:${port}/api`);
  console.log(`📄 Swagger UI disponible en http://localhost:${port}/api`);
  console.log(`📦 Postman JSON en http://localhost:${port}/api-json`);
}

void bootstrap();
