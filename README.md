# PrestamosYA API

Backend de **PrestamosYA**, una app móvil para administrar préstamos personales en Bolivia.  
El administrador del negocio presta dinero a clientes, genera cronogramas de cuotas y registra cobros diarios desde el celular.

> El frontend vive en el repositorio `prestamosya-mobile` (React Native + Expo). Este repositorio es **exclusivamente el backend**.

---

## Stack Técnico

| Capa | Tecnología |
|------|-----------|
| Framework | NestJS 11 |
| ORM | Prisma v7 |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT (access token, 7 días por defecto) |
| Almacenamiento de archivos | Cloudinary (imágenes de garantías, WebP optimizado con `sharp`) |
| Generación de PDF | `pdfmake` (server-side, fuentes Roboto) |
| Tareas programadas | `@nestjs/schedule` |
| Validación | `class-validator` + `class-transformer` |
| Documentación | Swagger / OpenAPI en `/api` |
| Servidor | VPS Ubuntu + Nginx + PM2 + CI/CD via GitHub Actions |
| Package manager | pnpm |
| Linter & Formatter | ESLint + Prettier + EditorConfig |

---

## Requisitos Previos

- **Node.js**: v18 o superior (v24 recomendado)
- **pnpm**: Configurado como gestor de paquetes
- **PostgreSQL 16**: Instancia local corriendo con una base de datos configurada

---

## Configuración del Proyecto

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Variables de entorno

Copia el archivo de ejemplo y edita los valores:

```bash
cp .env.example .env
```

Variables requeridas en `.env`:

```env
# Puerto de la API
PORT=3000
NODE_ENV=development

# Base de datos
DATABASE_URL="postgresql://usuario:password@localhost:5432/prestamosya"

# BD aislada para tests E2E (no tocar la de desarrollo)
TEST_DATABASE_URL="postgresql://usuario:password@localhost:5432/prestamosya_test"

# JWT — usar una cadena aleatoria larga (mínimo 64 caracteres)
JWT_SECRET="cadena_aleatoria_muy_larga_generada_con_openssl"
JWT_EXPIRES_IN="7d"

# Cloudinary — Almacenamiento de imágenes de garantías
# Obtener desde: https://console.cloudinary.com → Settings → API Keys
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### 3. Migraciones de base de datos

```bash
pnpm exec prisma migrate dev
```

### 4. Seed de datos iniciales

Genera el usuario administrador de desarrollo por defecto:

```bash
pnpm exec prisma db seed
```

---

## Ejecución

```bash
# Modo desarrollo (watch mode)
pnpm run start:dev

# Construcción de producción
pnpm run build

# Ejecución en producción
pnpm run start:prod
```

Una vez iniciado el servidor:

| Recurso | URL |
|---------|-----|
| **Swagger UI** (interactivo) | `http://localhost:3000/api` |
| **OpenAPI JSON** (Postman import) | `http://localhost:3000/api-json` |

---

## Autenticación

Todas las rutas requieren `Authorization: Bearer <access_token>` excepto `POST /api/auth/login`.

### Credenciales del seed de desarrollo

| Campo | Valor |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

### Flujo en Swagger UI

1. Navega a `http://localhost:3000/api`.
2. Expande `POST /api/auth/login` → **"Try it out"**.
3. Ingresa las credenciales del seed y presiona **"Execute"**.
4. Copia el valor de `accessToken` de la respuesta.
5. Pulsa el botón **"Authorize"** (candado) en la parte superior.
6. Pega el token y presiona **"Authorize"**.

### Flujo en Postman

1. Ve a **Import** → **Link**.
2. Pega `http://localhost:3000/api-json`.
3. Postman crea una colección completa organizada por módulo.
4. Ejecuta `POST /api/auth/login` para obtener el `accessToken`.
5. Configura **Authorization → Bearer Token** en la colección (se hereda a todas las carpetas).

> **Nota:** La API define la seguridad de forma global en `main.ts`. No se usa `@ApiBearerAuth()` en los controladores para no romper la herencia de tokens al importar en Postman.

---

## Endpoints REST

Prefijo global: `/api`. Formato de respuesta estándar:

```typescript
// Éxito
{ data: T, message?: string }

// Error
{ statusCode: number, message: string, error: string }
```

### Auth
```
POST   /api/auth/login           → { accessToken, user }    [público]
GET    /api/auth/me              → User payload              [protegido]
POST   /api/auth/logout          → { message }              [protegido]
```

### Users (self-service)
```
GET    /api/users/me               → UserResponseDto
PATCH  /api/users/me/password      → { message }   (requiere contraseña actual)
```

### Business Config
```
GET    /api/business-config        → BusinessConfigResponseDto
PATCH  /api/business-config        → BusinessConfigResponseDto (actualización parcial)
```

> Config 1:1 con el usuario autenticado. Se auto-crea con valores por defecto en el primer `GET`.

### Clients
```
GET    /api/clients               → Client[] (incluye activeLoanCount y ClientStatus)
POST   /api/clients               → Client
GET    /api/clients/:id           → ClientProfile { client, activeLoans[], completedLoans[], guarantees[] }
PATCH  /api/clients/:id           → Client
DELETE /api/clients/:id           → 200 OK (soft delete)
```

### Guarantees
```
POST   /api/guarantees                         → Guarantee con imageUrl   (multipart/form-data)
GET    /api/guarantees?clientId=xxx            → Guarantee[] con imageUrl
GET    /api/guarantees/:id                     → Guarantee con imageUrl
PATCH  /api/guarantees/:id                     → Guarantee con imageUrl   (multipart/form-data)
DELETE /api/guarantees/:id                     → 200 OK (soft delete; bloqueado si IN_USE)
```

> El campo de archivo es `image` (opcional). Formatos aceptados: JPG, PNG, WebP, GIF, BMP, TIFF. Tamaño máximo: 20 MB. El backend redimensiona a 800×800 px (WebP) con `sharp` antes de subir a Cloudinary.

### Loans
```
POST   /api/loans/simulate                    → Installment[] proyectadas (sin persistir)
POST   /api/loans                             → Loan + Installment[] generadas
GET    /api/loans/:id                         → LoanDetail (con cuotas y pagos)
GET    /api/loans/:id/installments            → Installment[]
POST   /api/loans/:id/guarantees              → LoanGuarantee (vincular garantía)
DELETE /api/loans/:id/guarantees/:guaranteeId → 200 OK (desvincular)
```

> - `startDate` (YYYY-MM-DD): fecha de desembolso. El backend calcula `firstDueDate = startDate + 1 período`.
> - `periodType`: `daily` | `weekly` | `fortnightly` | `monthly` | `custom`.
> - `scheduleType`: `EQUAL_INSTALLMENTS` (por defecto) | `INTEREST_ONLY` (Balloon: solo interés por cuota, capital en la última).
> - `mode`: `AUTOMATIC` (backend recalcula todo) | `MANUAL` (frontend envía `manualInstallments[]`).

### Payments
```
GET    /api/payments/dashboard?date=YYYY-MM-DD → { metadata, dueToday[], overdue[], paidToday[] }
POST   /api/payments                           → RegisterPaymentResult (aplica pago FIFO)
POST   /api/payments/settle                    → SettleLoanResult (liquidación anticipada)
DELETE /api/payments/:id                       → 200 OK (anular pago; requiere { reason } en body)
```

> Los pagos **nunca se eliminan**, solo se anulan (`voided=true`). El parámetro `?date` es opcional; si se omite, usa la fecha actual del servidor.

### Dashboard
```
GET    /api/dashboard/home → { capitalEnCalle: { BOB, USD }, loansSummary, clientsSummary, overdueInstallments[], generatedAt }
```

### Stats
```
GET  /api/stats/monthly?year=2026&month=9    → MonthlyStatsResponseDto (5 secciones)
GET  /api/stats/monthly-history?months=6    → MonthlyHistoryItemDto[] (orden cronológico)
GET  /api/stats/monthly-pdf?year=2026&month=9 → Buffer PDF (application/pdf)
```

> Si `year` y `month` se omiten, devuelve el mes en curso (zona `America/La_Paz`). El historial devuelve hasta 24 meses (por defecto 6).

### Notifications
```
GET    /api/notifications                         → NotificationItemDto[] (?page&limit&onlyUnread)
GET    /api/notifications/unread-count            → { unreadCount: number }
PATCH  /api/notifications/:id/read               → boolean
PATCH  /api/notifications/read-all               → { updatedCount: number }
POST   /api/notifications/device-tokens          → 201 Created  (body: { token, platform })
DELETE /api/notifications/device-tokens          → 200 OK       (body: { token })
POST   /api/notifications/trigger-daily-summary  → DailySummaryResultDto[] (solo admin)
```

### Admin
```
POST   /api/admin/recalculate-overdue → forzar recálculo manual del cron de mora
```

---

## Arquitectura

### Patrón general

Todos los módulos siguen la arquitectura estándar de NestJS:

```
controller.ts  ← recibe request, valida con DTOs, delega
service.ts     ← lógica de negocio, accede a Prisma directamente
dto/           ← un archivo por DTO (create, update, response, query)
```

### Excepción: módulo `loans` usa Clean Architecture

El módulo `loans` es el corazón financiero. Por la complejidad de sus cálculos (cronogramas, redondeo, tasas, pagos FIFO, liquidación anticipada) se implementó con **Clean Architecture** completa:

```
loans/
  domain/          ← TypeScript puro. Sin NestJS ni Prisma.
    entities/      ← LoanEntity, InstallmentEntity
    value-objects/ ← Money (decimal.js, inmutable, sin mezcla de monedas)
    services/      ← LoanCalculatorService
    repositories/  ← interfaces abstractas
    errors/        ← 9 clases de error de dominio
  application/
    use-cases/     ← 9 casos de uso implementados
    ports/         ← UnitOfWork (abstracción transaccional)
  infrastructure/
    repositories/  ← PrismaLoanRepository, PrismaInstallmentRepository, PrismaPaymentRepository
    mappers/       ← Prisma Decimal ↔ Money ↔ Response DTO
    loans.controller.ts
```

> **Regla de oro:** `domain/` no puede importar `@prisma/client`, `@nestjs/*`, ni hacer llamadas HTTP. Cualquier violación es un error de arquitectura.

### Módulos globales

- **`PrismaModule`**: `@Global()` — `PrismaService` inyectable en todos los módulos.
- **`CloudinaryModule`**: `@Global()` — `CloudinaryService` inyectable en cualquier módulo.

### Cron jobs

| Cron | Horario | Función |
|------|---------|---------|
| `OverdueCron` | 6:00 AM diario (La Paz) | Detecta cuotas vencidas, actualiza `daysOverdue`, sincroniza `ClientStatus` |
| `NotificationsCronService` | 8:00 AM diario (La Paz) | Resumen diario de cobros y clientes en mora vía in-app + push (Expo) |

---

## Reglas de Negocio Clave

- **Pagos nunca se eliminan** — solo se anulan con `voided=true` y `void_reason` obligatorio.
- **Cuotas nunca se eliminan** — al refinanciar se marcan `archived=true`. Siempre filtrar `archived=false` en queries del cronograma activo.
- **`prisma.$transaction`** siempre que una operación modifique más de una tabla.
- **`passwordHash` nunca se devuelve** en ninguna respuesta de la API.
- **Nunca mezclar monedas** (BOB/USD) en un mismo cálculo financiero.
- **La última cuota absorbe la diferencia de redondeo** — la suma de todas las cuotas debe ser exactamente igual a `loan.totalAmount`.
- **`firstDueDate` lo calcula el backend** — el frontend solo envía `startDate`; la primera cuota es `startDate + 1 período`.
- **Refinanciamiento (Fase 9 — pendiente)**: La tabla `loan_refinances` y los métodos de dominio ya existen, pero el use-case y el endpoint no están implementados todavía.

---

## Testing

Estrategia completa en [`.agents/TESTING.md`](./.agents/TESTING.md).

### Unit tests (sin BD)

```bash
pnpm test              # correr todos los unit tests
pnpm run test:cov      # con reporte de cobertura
pnpm run test:watch    # modo watch
```

### Tests E2E (requieren BD de test)

Los tests E2E arrancan la app real contra una BD aislada (`prestamosya_test`).

1. Crear la BD de test (una sola vez):
   ```bash
   PGPASSWORD=tu_password psql -h localhost -U postgres -c "CREATE DATABASE prestamosya_test;"
   ```
2. Asegúrate de tener `TEST_DATABASE_URL` definida en `.env`.
3. Ejecutar (el script `pretest:e2e` aplica migraciones y seed automáticamente):
   ```bash
   pnpm run test:e2e
   ```

### Todos los tests

```bash
pnpm run test:all   # unit + E2E en secuencia
```

---

## Sistema de Módulos (CommonJS + Prisma v7)

> ⚠️ **No cambiar esta configuración sin entender las implicaciones.**

NestJS compila a **CommonJS**. Prisma v7 genera ESM por defecto. La convivencia requiere:

- `tsconfig.json`: `"module": "CommonJS"` (no ESNext, no bundler).
- `prisma/schema.prisma`: `moduleFormat = "commonjs"` en el generator.
- `PrismaService` importa desde `../generated/prisma/client` (no desde `@prisma/client`).
- Prisma v7 requiere el driver adapter `PrismaPg` en el constructor de `PrismaClient`.

Si el build está bien configurado, `dist/src/main.js` debe comenzar con `"use strict"` y `require(...)`, no con `import`.

Detalles completos en [`.agents/STACK.md`](./.agents/STACK.md).

---

## Contexto para Agentes y Colaboradores

El directorio [`.agents/`](./.agents/) contiene la documentación técnica completa del proyecto:

| Archivo | Contenido |
|---------|-----------|
| [`AGENT.md`](./.agents/AGENT.md) | Archivo pivote — reglas críticas y flujos clave |
| [`STACK.md`](./.agents/STACK.md) | Stack, decisiones técnicas e infraestructura |
| [`ARCHITECTURE.md`](./.agents/ARCHITECTURE.md) | Estructura de carpetas y patrones por módulo |
| [`DATABASE.md`](./.agents/DATABASE.md) | Schema Prisma completo, modelos y relaciones |
| [`BUSINESS_RULES.md`](./.agents/BUSINESS_RULES.md) | Reglas financieras de pagos, cuotas y mora |
| [`API.md`](./.agents/API.md) | Inventario completo de endpoints REST |
| [`LOANS_MODULE.md`](./.agents/LOANS_MODULE.md) | Detalle de fases y estado del módulo loans |
| [`NOTIFICATIONS_MODULE.md`](./.agents/NOTIFICATIONS_MODULE.md) | Arquitectura del módulo de notificaciones |
| [`CONVENTIONS.md`](./.agents/CONVENTIONS.md) | Nomenclatura, DTOs, commits y ramas |
| [`TESTING.md`](./.agents/TESTING.md) | Estrategia de testing y patrones por módulo |
