# DATABASE.md — prestamosya-api

Esquema completo de la base de datos. PostgreSQL 16 gestionado con Prisma ORM.
**12 tablas para el MVP.**

Convenciones: columnas en `snake_case` en BD (gestionado con `@map` en Prisma), campos en `camelCase` en código TypeScript.

---

## Resumen de tablas

| Tabla | Descripción |
|-------|-------------|
| `users` | Administradores y cobradores del sistema |
| `session_tokens` | Refresh tokens hasheados (revocables) |
| `business_config` | Configuración del negocio por usuario |
| `clients` | Prestatarios — soft delete con `deleted_at` |
| `guarantees` | Bienes del cliente como garantía |
| `guarantee_photos` | Fotos de garantías (URL del proveedor externo) |
| `loans` | Préstamos activos e históricos |
| `loan_guarantees` | Relación N:M entre préstamo y garantía |
| `installments` | Cuotas del cronograma — nunca se eliminan |
| `payments` | Pagos registrados — nunca se eliminan, solo se anulan |
| `payment_installments` | Distribución de un pago entre cuotas |
| `loan_refinances` | Snapshot histórico de cada refinanciamiento |

---

## Esquema completo (Prisma)

> **Nota sobre timestamps:** El bloque de schema siguiente es histórico/resumido. Para el detalle actual de tipos de columna (todas las marcas temporales son `@db.Timestamptz(3)` y las de solo fecha `@db.Date`) y la política de zona horaria, ver la sección [Zonas horarias y timestamps](#zonas-horarias-y-timestamps). La fuente de verdad es `prisma/schema.prisma`.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "commonjs"
}

datasource db {
  provider = "postgresql"
}

> **Nota:** Este proyecto usa **Prisma v7**. El generador es `prisma-client` (no `prisma-client-js`) con `moduleFormat = "commonjs"` para que el cliente generado sea compatible con la compilación CommonJS de NestJS. La `url` de conexión no va en el `datasource`; se inyecta desde `prisma.config.ts` (`defineConfig({ datasource: { url: process.env['DATABASE_URL'] } })`). Ver `STACK.md` → "Configuración del sistema de módulos".

// ─── ENUMS ───────────────────────────────────────────

enum Role {
  admin
  collector
}

enum Currency {
  BOB
  USD
}

enum PeriodType {
  daily
  weekly
  fortnightly
  monthly
  custom
}

enum LoanMode {
  automatic
  manual
}

enum LoanStatus {
  ACTIVE
  COMPLETED
  DEFAULTED
  REFINANCED
}

enum InstallmentStatus {
  PENDING
  PARTIAL
  PAID
  OVERDUE
}

enum PaymentMethod {
  cash
  transfer
  qr     // Deprecado: la app solo acepta cash y transfer. qr permanece en DB por compatibilidad.
}

enum ClientStatus {
  NO_LOAN
  CURRENT
  DELINQUENT
}

enum GuaranteeType {
  VEHICLE
  REAL_ESTATE
  FURNITURE
  OTHER
}

enum GuaranteeStatus {
  AVAILABLE
  IN_USE
  RELEASED
}

enum GuaranteeLinkStatus {
  ACTIVE
  RELEASED
}

enum RefinanceType {
  EXTEND_TERM
  ADDITIONAL_AMOUNT
  NEW_RATE
}

// ─── MODELOS ─────────────────────────────────────────

model User {
  id            String   @id @default(uuid())
  name          String   @db.VarChar(100)
  username      String   @unique @db.VarChar(50)
  passwordHash  String   @map("password_hash") @db.VarChar(255)
  role          Role     @default(admin)
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  sessionTokens  SessionToken[]
  businessConfig BusinessConfig?
  clients        Client[]
  loans          Loan[]
  payments       Payment[]

  @@map("users")
}

model SessionToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash") @db.VarChar(255)
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("session_tokens")
}

model BusinessConfig {
  id                  String      @id @default(uuid())
  userId              String      @unique @map("user_id")
  businessName        String?     @map("business_name") @db.VarChar(150)
  primaryCurrency     Currency    @default(BOB) @map("primary_currency")
  exchangeRate        Decimal     @default(6.96) @map("exchange_rate") @db.Decimal(10, 4)
  defaultInterestRate Decimal?    @map("default_interest_rate") @db.Decimal(5, 2)
  defaultPeriodType   PeriodType? @map("default_period_type")
  graceDays           Int         @default(0) @map("grace_days")
  createdAt           DateTime    @default(now()) @map("created_at")
  updatedAt           DateTime    @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@map("business_config")
}

model Client {
  id           String       @id @default(uuid())
  userId       String       @map("user_id")
  fullName     String       @map("full_name") @db.VarChar(150)
  idNumber     String       @unique @map("id_number") @db.VarChar(20)
  phone        String       @db.VarChar(20)
  phoneAlt     String?      @map("phone_alt") @db.VarChar(20)
  address      String?
  latitude     Decimal?     @db.Decimal(10, 8)
  longitude    Decimal?     @db.Decimal(11, 8)
  status       ClientStatus @default(NO_LOAN)
  notes        String?
  deletedAt    DateTime?    @map("deleted_at")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  user       User        @relation(fields: [userId], references: [id])
  loans      Loan[]
  guarantees Guarantee[]

  @@index([phone])
  @@index([fullName])
  @@index([status])
  @@index([latitude, longitude])
  @@map("clients")
}

model Guarantee {
  id             String          @id @default(uuid())
  clientId       String          @map("client_id")
  type           GuaranteeType
  description    String
  estimatedValue Decimal?        @map("estimated_value") @db.Decimal(12, 2)
  status         GuaranteeStatus @default(AVAILABLE)
  deletedAt      DateTime?       @map("deleted_at")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  client       Client           @relation(fields: [clientId], references: [id])
  photos       GuaranteePhoto[]
  loanLinks    LoanGuarantee[]

  @@index([clientId])
  @@index([status])
  @@map("guarantees")
}

model GuaranteePhoto {
  id          String   @id @default(uuid())
  guaranteeId String   @map("guarantee_id")
  fileUrl     String   @map("file_url") @db.VarChar(500)
  createdAt   DateTime @default(now()) @map("created_at")

  guarantee Guarantee @relation(fields: [guaranteeId], references: [id])

  @@map("guarantee_photos")
}

model Loan {
  id                 String      @id @default(uuid())
  clientId           String      @map("client_id")
  createdBy          String      @map("created_by")
  mode               LoanMode
  capitalAmount      Decimal     @map("capital_amount") @db.Decimal(12, 2)
  currency           Currency    @default(BOB)
  interestRate       Decimal     @default(0) @map("interest_rate") @db.Decimal(5, 2)
  periodType         PeriodType? @map("period_type")
  totalInstallments  Int         @map("total_installments")
  totalAmount        Decimal     @map("total_amount") @db.Decimal(12, 2)
  totalPaid          Decimal     @default(0) @map("total_paid") @db.Decimal(12, 2)
  outstandingBalance Decimal     @map("outstanding_balance") @db.Decimal(12, 2)
  status             LoanStatus  @default(ACTIVE)
  startDate          DateTime    @map("start_date") @db.Date
  firstDueDate       DateTime    @map("first_due_date") @db.Date
  notes              String?
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")

  client       Client          @relation(fields: [clientId], references: [id])
  creator      User            @relation(fields: [createdBy], references: [id])
  installments Installment[]
  payments     Payment[]
  guarantees   LoanGuarantee[]
  refinances   LoanRefinance[]

  @@index([clientId])
  @@index([status])
  @@index([clientId, status])
  @@map("loans")
}

model LoanGuarantee {
  id          String              @id @default(uuid())
  loanId      String              @map("loan_id")
  guaranteeId String              @map("guarantee_id")
  status      GuaranteeLinkStatus @default(ACTIVE)
  createdAt   DateTime            @default(now()) @map("created_at")
  releasedAt  DateTime?           @map("released_at")

  loan      Loan      @relation(fields: [loanId], references: [id])
  guarantee Guarantee @relation(fields: [guaranteeId], references: [id])

  @@index([loanId])
  @@index([guaranteeId])
  @@map("loan_guarantees")
}

model Installment {
  id                String            @id @default(uuid())
  loanId            String            @map("loan_id")
  installmentNumber Int               @map("installment_number")
  dueDate           DateTime          @map("due_date") @db.Date
  capitalAmount     Decimal           @map("capital_amount") @db.Decimal(12, 2)
  interestAmount    Decimal           @default(0) @map("interest_amount") @db.Decimal(12, 2)
  totalAmount       Decimal           @map("total_amount") @db.Decimal(12, 2)
  paidAmount        Decimal           @default(0) @map("paid_amount") @db.Decimal(12, 2)
  status            InstallmentStatus @default(PENDING)
  daysOverdue       Int               @default(0) @map("days_overdue")
  paidAt            DateTime?         @map("paid_at")
  archived          Boolean           @default(false)
  createdAt         DateTime          @default(now()) @map("created_at")
  updatedAt         DateTime          @updatedAt @map("updated_at")

  loan         Loan                 @relation(fields: [loanId], references: [id])
  paymentLinks PaymentInstallment[]

  @@index([loanId])
  @@index([dueDate])
  @@index([status])
  @@index([dueDate, status])
  @@map("installments")
}

model Payment {
  id           String        @id @default(uuid())
  loanId       String        @map("loan_id")
  registeredBy String        @map("registered_by")
  amount       Decimal       @db.Decimal(12, 2)
  paymentDate  DateTime      @map("payment_date") @db.Date
  method       PaymentMethod @default(cash)
  notes        String?
  voided       Boolean       @default(false)
  voidedAt     DateTime?     @map("voided_at")
  voidReason   String?       @map("void_reason")
  createdAt    DateTime      @default(now()) @map("created_at")

  loan             Loan                 @relation(fields: [loanId], references: [id])
  registrar        User                 @relation(fields: [registeredBy], references: [id])
  installmentLinks PaymentInstallment[]

  @@index([loanId])
  @@index([paymentDate])
  @@index([voided])
  @@map("payments")
}

model PaymentInstallment {
  id            String  @id @default(uuid())
  paymentId     String  @map("payment_id")
  installmentId String  @map("installment_id")
  amountApplied Decimal @map("amount_applied") @db.Decimal(12, 2)

  payment     Payment     @relation(fields: [paymentId], references: [id])
  installment Installment @relation(fields: [installmentId], references: [id])

  @@index([paymentId])
  @@index([installmentId])
  @@map("payment_installments")
}

model LoanRefinance {
  id                   String        @id @default(uuid())
  loanId               String        @map("loan_id")
  refinanceType        RefinanceType @map("refinance_type")
  previousBalance      Decimal       @map("previous_balance") @db.Decimal(12, 2)
  previousInstallments Int           @map("previous_installments")
  previousRate         Decimal       @map("previous_rate") @db.Decimal(5, 2)
  additionalAmount     Decimal       @default(0) @map("additional_amount") @db.Decimal(12, 2)
  amountDelivered      Decimal       @default(0) @map("amount_delivered") @db.Decimal(12, 2)
  newRate              Decimal       @map("new_rate") @db.Decimal(5, 2)
  newInstallments      Int           @map("new_installments")
  newTotalAmount       Decimal       @map("new_total_amount") @db.Decimal(12, 2)
  notes                String?
  createdAt            DateTime      @default(now()) @map("created_at")

  loan Loan @relation(fields: [loanId], references: [id])

  @@index([loanId])
  @@map("loan_refinances")
}
```

---

## Migraciones y Seeding (Prisma 7)

### Migraciones aplicadas

| Migración | Descripción |
|-----------|-------------|
| `20260615150807_init` | Esquema inicial del MVP |
| `20260818012602_add_fortnightly_period` | Agrega `fortnightly` (quincenal) al enum `PeriodType`. Aplicada en dev y se aplicará automáticamente en prod vía `prisma migrate deploy` en el CI/CD |
| `20260827181308_timestamps_timestamptz` | Convierte todas las columnas de marca temporal (`created_at`, `updated_at`, `deleted_at`, `expires_at`, `paid_at`, `voided_at`, `released_at`) de `TIMESTAMP` a `TIMESTAMPTZ`. Las columnas de solo fecha (`start_date`, `first_due_date`, `due_date`, `payment_date`) se mantienen como `DATE`. Ver sección "Zonas horarias y timestamps" más abajo |

---

## Zonas horarias y timestamps

La aplicación **siempre opera en hora boliviana (`America/La_Paz`, UTC-4)**, tanto en el backend como en la base de datos, independientemente de la zona del VPS donde corra PostgreSQL.

Cómo se garantiza:

- **`src/main.ts`**: fija `process.env.TZ = 'America/La_Paz'` en el proceso Node. Así todos los `Date` que el backend genera (`new Date()`) y que Prisma envía a la BD (pagos, anulaciones, `paidAt`, `voidedAt`, etc.) se escriben en hora boliviana.
- **`src/prisma/prisma.service.ts`**: el `Pool` de `pg` se crea con `options: '-c timezone=America/La_Paz'`, que PostgreSQL aplica al establecer la conexión (sin condición de carrera). Así los timestamps evaluados del lado de PostgreSQL (`DEFAULT CURRENT_TIMESTAMP`, `now()`) se generan en hora boliviana sin depender del `postgresql.conf` del host.
- **Columnas de marca temporal** son `TIMESTAMPTZ(3)` (`@db.Timestamptz(3)` en Prisma): PostgreSQL almacena el instante absoluto (UTC interno) y lo interpreta según la zona de la sesión, eliminando ambigüedades.
- **Columnas de solo fecha** (`@db.Date`): `Loan.startDate`, `Loan.firstDueDate`, `Installment.dueDate`, `Payment.paymentDate` — representan un día de negocio y se mantienen como `DATE`.

**Respuestas de la API:** los timestamps se serializan a ISO 8601 con `Z` (UTC) vía `Date.toISOString()`. Es el mismo instante absoluto; el frontend es responsable de convertirlo a su zona para mostrar (o `America/La_Paz`).

**Verificación rápida en prod:** ante la BD, `SELECT now()` debe mostrar la hora boliviana actual, y `SHOW timezone` debe devolver `America/La_Paz`.

### Configuración
En **Prisma 7**, las migraciones y la ejecución de seeds se centralizan en `prisma.config.ts` (en lugar de `package.json`):
```typescript
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts', // Se utiliza tsx para soportar módulos ESNext/ESM directamente
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
```

### Script de Seed (`prisma/seed.ts`)
El script de inicialización realiza las siguientes operaciones en orden:
1. **Conexión Nativa (`@prisma/adapter-pg`)**: Crea un pool con `pg` y su adaptador, lo cual es obligatorio en la configuración actual de Prisma v7.
2. **Usuarios Administradores**: Realiza un `upsert` para crear dos administradores:
   - **Admin 1**: username `admin`, password `admin123` — 2 clientes asignados
   - **Admin 2**: username `admin2`, password `admin123` — 1 cliente asignado
3. **Configuración de Negocio**: Crea un registro en `business_config` para cada administrador.
4. **Clientes**: Crea 3 clientes totales (2 para admin1, 1 para admin2) con datos de prueba variados.

### Comandos de Base de Datos (pnpm)
- **Ejecutar Seed manualmente**:
  ```bash
  pnpm exec prisma db seed
  ```
- **Crear y aplicar migraciones**:
  ```bash
  pnpm exec prisma migrate dev --name <nombre_migracion>
  ```
- **Sincronizar base de datos sin generar migración**:
  ```bash
  pnpm exec prisma db push
  ```

---

## Tablas post-MVP (no implementar ahora)

- `visit_logs` — registro de visitas de cobro sin éxito
- `capital_movements` — control de inyecciones de capital y retiro de utilidades
- `whatsapp_templates` — los mensajes de WhatsApp son hardcodeados en el frontend para el MVP
