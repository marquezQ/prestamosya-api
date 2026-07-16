# STACK.md — prestamosya-api

Stack tecnológico, infraestructura, variables de entorno y decisiones técnicas registradas.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | NestJS |
| ORM | Prisma |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT + Refresh Tokens |
| Almacenamiento de archivos | **POR DECIDIR** — Cloudinary, ImageKit u otro servicio gratuito/freemium. No implementar hasta que se tome la decisión. |
| Tareas programadas | @nestjs/schedule |
| Validación | class-validator + class-transformer |
| Documentación | Swagger (OpenAPI) en `/api/docs` |
| Servidor | VPS Ubuntu + Nginx + PM2 + CI/CD via GitHub Actions |
| Package manager | pnpm |
| Linter & Formatter | ESLint + Prettier + EditorConfig (con formateo al guardar en VS Code) |

---

## Variables de entorno requeridas

```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/prestamosya

# JWT
JWT_SECRET=cadena_aleatoria_muy_larga_minimo_64_caracteres
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=otra_cadena_aleatoria_diferente
JWT_REFRESH_EXPIRES_IN=30d

# App
PORT=3000
NODE_ENV=development

# Almacenamiento de archivos — POR DECIDIR, no implementar aún
# FILE_STORAGE_PROVIDER=
# FILE_STORAGE_API_KEY=
```

---

## Infraestructura de producción

- VPS Ubuntu
- PostgreSQL nativo (sin Docker en producción — VPS con recursos limitados)
- PM2 como process manager
- Nginx como reverse proxy
- CI/CD via GitHub Actions

---

## Configuración del sistema de módulos (CommonJS vs ESM)

> **⚠️ CRÍTICO — No cambiar esta configuración sin entender las implicaciones.**

Este proyecto usa **CommonJS** en NestJS y **Prisma v7** como ORM. La convivencia entre ambos requiere configuración explícita porque Prisma v7 genera código ESM por defecto.

### Por qué CommonJS en NestJS

NestJS fue diseñado para CommonJS. Su sistema de decoradores (`@Module`, `@Injectable`, etc.) depende de `emitDecoratorMetadata`, que funciona correctamente solo en CJS. Intentar usar ESM nativo con NestJS produce archivos híbridos que Node.js no puede ejecutar.

### Por qué `moduleFormat = "commonjs"` en Prisma

Prisma v7 (`prisma-client` generator) genera código **ESM por defecto**. Si no se especifica `moduleFormat = "commonjs"`, el cliente generado en `src/generated/prisma` será ESM, y al importarlo desde NestJS (que compila a CJS) Node.js lanza `ERR_MODULE_NOT_FOUND` porque los imports ESM sin extensión `.js` explícita no se resuelven en el runtime de Node.

### Archivos afectados y su configuración correcta

**`tsconfig.json`** — compila TypeScript a CommonJS:
```json
{
  "module": "CommonJS",
  "moduleResolution": "node",
  "target": "ES2023",
  "emitDecoratorMetadata": true,
  "experimentalDecorators": true
}
```
> **NO usar** `"module": "ESNext"` ni `"moduleResolution": "bundler"` — esas opciones son para bundlers como Vite o esbuild, no para Node.js directo.

**`prisma/schema.prisma`** — genera el client en CJS:
```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "commonjs"
}
```

**`src/prisma/prisma.service.ts`** — importa desde la ruta generada, NO desde `@prisma/client`:
```typescript
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
```
> Prisma v7 requiere el driver adapter (`PrismaPg`) y un `Pool` de `pg`. El adapter se pasa en el constructor de `PrismaClient`.

### Señal de que está bien configurado

Al hacer `pnpm run build`, el archivo `dist/src/main.js` debe comenzar con:
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
```
Si en cambio ves `import { NestFactory } from '@nestjs/core'` → la configuración está rota.

### Cuando actualizar Prisma

Si en el futuro se actualiza Prisma (ej: v7 → v8), ejecutar siempre:
```bash
rm -rf dist/
pnpm prisma generate
pnpm run build
```

---

## Decisiones técnicas registradas

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| **CommonJS en NestJS** | ESM nativo | `emitDecoratorMetadata` y la DI de Nest funcionan correctamente solo en CJS. ESM nativo genera conflictos con el runtime de Node sin bundler. |
| **`moduleFormat=commonjs` en Prisma v7** | Default ESM de Prisma | Prisma v7 genera ESM por defecto. Sin esta opción, el cliente generado es incompatible con la compilación CJS de NestJS → `ERR_MODULE_NOT_FOUND`. |
| Clean Architecture solo en loans | Aplicar en todos los módulos | Los demás módulos son CRUD simple — agregar capas sería sobreingeniería |
| Arquitectura estándar NestJS en el resto | Clean Architecture global | Velocidad de desarrollo, menos archivos, suficiente para la complejidad real |
| Prisma sobre TypeORM | TypeORM | Schema como fuente de verdad, generación automática de tipos, migraciones más simples |
| PostgreSQL sobre MongoDB | MongoDB | Datos financieros requieren ACID y relaciones. Los datos son relacionales por naturaleza |
| JWT + Refresh Tokens | Solo JWT | Sesión persistente sin comprometer seguridad. Refresh tokens revocables en BD |
| Sin Docker en producción | Docker Compose | VPS con recursos limitados — PostgreSQL nativo + PM2 es más eficiente |
| Redis no incluido | Redis para cache | No necesario para el volumen del MVP. Se evalúa en Fase 2 si el dashboard es lento |
| Garantías al cliente | Garantías al préstamo | Un cliente puede tener múltiples bienes. Se reutilizan entre préstamos |
| Pagos nunca se eliminan | Hard delete | Auditoría financiera. Todo movimiento de dinero debe tener trazabilidad completa |
| `archived` en cuotas | Eliminar al refinanciar | Historial completo del préstamo. Las cuotas archivadas son invisibles en la UI pero existen en BD |

## Decisiones pendientes

| Decisión | Opciones en evaluación | Bloqueado hasta |
|----------|----------------------|-----------------|
| Almacenamiento de archivos | Cloudinary, ImageKit, u otro freemium | Antes de implementar guarantees/photos |
| Framework de testing | Por definir | Antes de escribir el primer test |
| Clean Architecture en payments | Aplicar parcialmente | Si la complejidad del módulo lo requiere a futuro |

---

## Tickets de Linear

El proyecto se gestiona en Linear bajo el proyecto **PrestApp — App de Préstamos**.
Cada rama de git debe corresponder a un ticket: `feature/PED-XX-descripcion-breve`

Sprint 0 activo (hasta 16 jun):
- PED-5 — Schema Prisma ← DONE
- PED-7 — Inicializar repo NestJS
- PED-9 — Migraciones y seed ← DONE
- PED-6 — Setup VPS
- PED-10 — Configurar VPS
