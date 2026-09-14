# DATABASE.md — prestamosya-api

Esquema completo de la base de datos. PostgreSQL 16 gestionado con Prisma ORM.
**12 tablas para el MVP.**

Convenciones: columnas en `snake_case` en BD (gestionado con `@map` en Prisma), campos en `camelCase` en código TypeScript.

---

## Resumen de tablas

| Tabla                  | Descripción                                             |
| ---------------------- | ------------------------------------------------------- |
| `users`                | Administradores y cobradores del sistema                |
| `session_tokens`       | Refresh tokens hasheados (revocables)                   |
| `business_config`      | Configuración del negocio por usuario                   |
| `clients`              | Prestatarios — soft delete con `deleted_at`             |
| `guarantees`           | Bienes del cliente como garantía                        |
| `guarantee_photos`     | Fotos de garantías (URL del proveedor externo)          |
| `loans`                | Préstamos activos e históricos                          |
| `loan_guarantees`      | Relación N:M entre préstamo y garantía                  |
| `installments`         | Cuotas del cronograma — nunca se eliminan               |
| `payments`             | Pagos registrados — nunca se eliminan, solo se anulan   |
| `payment_installments` | Distribución de un pago entre cuotas (desglose banking) |
| `loan_refinances`      | Snapshot histórico de cada refinanciamiento             |

---

## Esquema completo (Prisma)

> **Nota:** La fuente de verdad es `prisma/schema.prisma`. Este bloque refleja el estado actualizado con todos los campos incluidos `scheduleType`, `discountAmount` y el reestructurado `payment_installments`.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "commonjs"
}

datasource db {
  provider = "postgresql"
}

// ─── ENUMS ───────────────────────────────────────────

enum Role { admin, collector }
enum Currency { BOB, USD }
enum PeriodType { daily, weekly, fortnightly, monthly, custom }
enum LoanMode { automatic, manual }
enum LoanScheduleType { EQUAL_INSTALLMENTS, INTEREST_ONLY }
enum LoanStatus { ACTIVE, COMPLETED, DEFAULTED, REFINANCED }
enum InstallmentStatus { PENDING, PARTIAL, PAID, OVERDUE }
enum PaymentMethod { cash, transfer, qr }  // qr deprecado
enum ClientStatus { NO_LOAN, CURRENT, DELINQUENT }
enum GuaranteeType { VEHICLE, REAL_ESTATE, FURNITURE, OTHER }
enum GuaranteeStatus { AVAILABLE, IN_USE, RELEASED }
enum GuaranteeLinkStatus { ACTIVE, RELEASED }
enum RefinanceType { EXTEND_TERM, ADDITIONAL_AMOUNT, NEW_RATE }

// ─── MODELOS ─────────────────────────────────────────

model User {
  id            String   @id @default(uuid())
  name          String   @db.VarChar(100)
  username      String   @unique @db.VarChar(50)
  passwordHash  String   @map("password_hash") @db.VarChar(255)
  role          Role     @default(admin)
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt     DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")
  businessConfig BusinessConfig?
  clients        Client[]
  loans          Loan[]
  payments       Payment[]
  sessionTokens  SessionToken[]
  @@map("users")
}

model SessionToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash") @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz(3) @map("expires_at")
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  user      User     @relation(fields: [userId], references: [id])
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
  createdAt           DateTime    @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt           DateTime    @updatedAt @db.Timestamptz(3) @map("updated_at")
  user                User        @relation(fields: [userId], references: [id])
  @@map("business_config")
}

model Client {
  id         String       @id @default(uuid())
  userId     String       @map("user_id")
  fullName   String       @map("full_name") @db.VarChar(150)
  idNumber   String       @map("id_number") @db.VarChar(20)
  phone      String       @db.VarChar(20)
  phoneAlt   String?      @map("phone_alt") @db.VarChar(20)
  address    String?
  latitude   Decimal?     @db.Decimal(10, 8)
  longitude  Decimal?     @db.Decimal(11, 8)
  status     ClientStatus @default(NO_LOAN)
  notes      String?
  deletedAt  DateTime?    @db.Timestamptz(3) @map("deleted_at")
  createdAt  DateTime     @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt  DateTime     @updatedAt @db.Timestamptz(3) @map("updated_at")
  user       User         @relation(fields: [userId], references: [id])
  guarantees Guarantee[]
  loans      Loan[]
  @@unique([userId, idNumber])
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
  deletedAt      DateTime?       @db.Timestamptz(3) @map("deleted_at")
  createdAt      DateTime        @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt      DateTime        @updatedAt @db.Timestamptz(3) @map("updated_at")
  client         Client          @relation(fields: [clientId], references: [id])
  photos         GuaranteePhoto[]
  loanLinks      LoanGuarantee[]
  @@index([clientId])
  @@index([status])
  @@map("guarantees")
}

model GuaranteePhoto {
  id          String   @id @default(uuid())
  guaranteeId String   @map("guarantee_id")
  fileUrl     String   @map("file_url") @db.VarChar(500)
  createdAt   DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  guarantee   Guarantee @relation(fields: [guaranteeId], references: [id])
  @@map("guarantee_photos")
}

model Loan {
  id                 String          @id @default(uuid())
  clientId           String          @map("client_id")
  createdBy          String          @map("created_by")
  mode               LoanMode
  scheduleType       LoanScheduleType @default(EQUAL_INSTALLMENTS) @map("schedule_type")
  capitalAmount      Decimal         @map("capital_amount") @db.Decimal(12, 2)
  currency           Currency        @default(BOB)
  interestRate       Decimal         @default(0) @map("interest_rate") @db.Decimal(5, 2)
  periodType         PeriodType?     @map("period_type")
  totalInstallments  Int             @map("total_installments")
  totalAmount        Decimal         @map("total_amount") @db.Decimal(12, 2)
  totalPaid          Decimal         @default(0) @map("total_paid") @db.Decimal(12, 2)
  outstandingBalance Decimal         @map("outstanding_balance") @db.Decimal(12, 2)
  status             LoanStatus      @default(ACTIVE)
  startDate          DateTime        @map("start_date") @db.Date
  firstDueDate       DateTime        @map("first_due_date") @db.Date
  notes              String?
  createdAt          DateTime        @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt          DateTime        @updatedAt @db.Timestamptz(3) @map("updated_at")
  installments       Installment[]
  guarantees         LoanGuarantee[]
  refinances         LoanRefinance[]
  client             Client          @relation(fields: [clientId], references: [id])
  creator            User            @relation(fields: [createdBy], references: [id])
  payments           Payment[]
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
  createdAt   DateTime            @default(now()) @db.Timestamptz(3) @map("created_at")
  releasedAt  DateTime?           @db.Timestamptz(3) @map("released_at")
  guarantee   Guarantee           @relation(fields: [guaranteeId], references: [id])
  loan        Loan                @relation(fields: [loanId], references: [id], onDelete: Cascade)
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
  paidAt            DateTime?         @db.Timestamptz(3) @map("paid_at")
  archived          Boolean           @default(false)
  createdAt         DateTime          @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt         DateTime          @updatedAt @db.Timestamptz(3) @map("updated_at")
  loan              Loan              @relation(fields: [loanId], references: [id], onDelete: Cascade)
  paymentLinks      PaymentInstallment[]
  @@index([loanId])
  @@index([dueDate])
  @@index([status])
  @@index([dueDate, status])
  @@map("installments")
}

model Payment {
  id               String               @id @default(uuid())
  loanId           String               @map("loan_id")
  registeredBy     String               @map("registered_by")
  amount           Decimal              @db.Decimal(12, 2)
  discountAmount   Decimal              @default(0) @map("discount_amount") @db.Decimal(12, 2)
  paymentDate      DateTime             @map("payment_date") @db.Date
  method           PaymentMethod        @default(cash)
  notes            String?
  voided           Boolean              @default(false)
  voidedAt         DateTime?            @db.Timestamptz(3) @map("voided_at")
  voidReason       String?              @map("void_reason")
  createdAt        DateTime             @default(now()) @db.Timestamptz(3) @map("created_at")
  installmentLinks PaymentInstallment[]
  loan             Loan                 @relation(fields: [loanId], references: [id], onDelete: Cascade)
  registrar        User                 @relation(fields: [registeredBy], references: [id])
  @@index([loanId])
  @@index([paymentDate])
  @@index([voided])
  @@map("payments")
}

model PaymentInstallment {
  id                 String      @id @default(uuid())
  paymentId          String      @map("payment_id")
  installmentId      String      @map("installment_id")
  interestPaid       Decimal     @default(0) @map("interest_paid")       @db.Decimal(12, 2)
  capitalPaid        Decimal     @default(0) @map("capital_paid")        @db.Decimal(12, 2)
  interestDiscounted Decimal     @default(0) @map("interest_discounted") @db.Decimal(12, 2)
  capitalDiscounted  Decimal     @default(0) @map("capital_discounted")  @db.Decimal(12, 2)
  installment        Installment @relation(fields: [installmentId], references: [id], onDelete: Cascade)
  payment            Payment     @relation(fields: [paymentId], references: [id], onDelete: Cascade)
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
  createdAt            DateTime      @default(now()) @db.Timestamptz(3) @map("created_at")
  loan                 Loan          @relation(fields: [loanId], references: [id], onDelete: Cascade)
  @@index([loanId])
  @@map("loan_refinances")
}
```

---

## ON DELETE CASCADE en relaciones de loans

> [!IMPORTANT]
> Borrar un registro en `loans` cascada automáticamente hacia todas las tablas dependientes:
>
> | Tabla hija             | Efecto                                                                   |
> | ---------------------- | ------------------------------------------------------------------------ |
> | `installments`         | Se borran todas las cuotas del préstamo                                  |
> | `payment_installments` | Se borran los desgloses (vía cascade desde installments Y payments)      |
> | `payments`             | Se borran todos los pagos registrados                                    |
> | `loan_guarantees`      | Se borran los links (las garantías NO se borran — pertenecen al cliente) |
> | `loan_refinances`      | Se borran los snapshots de refinanciamiento                              |
>
> **NO se borran** (permanecen intactos): `clients`, `guarantees`, `guarantee_photos`, `users`, `session_tokens`, `business_config`.
>
> Esto es intencional: fue diseñado para facilitar la limpieza de datos de prueba en desarrollo. No existe un endpoint API que borre loans — solo se puede hacer desde el cliente de BD directamente.

---

## Migraciones aplicadas

| Migración                                                            | Descripción                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260615150807_init`                                                | Esquema inicial del MVP                                                                                                                                                                               |
| `20260818012602_add_fortnightly_period`                              | Agrega `fortnightly` al enum `PeriodType`                                                                                                                                                             |
| `20260827181308_timestamps_timestamptz`                              | Convierte todas las columnas de marca temporal a `TIMESTAMPTZ`. Columnas de solo fecha (`start_date`, `first_due_date`, `due_date`, `payment_date`) se mantienen como `DATE`                          |
| `20260830153853_add_discount_amount_to_payments`                     | Agrega `discount_amount` DECIMAL(12,2) default 0 a `payments`                                                                                                                                         |
| `20260831012844_add_schedule_type_to_loans`                          | Crea enum `LoanScheduleType` (`EQUAL_INSTALLMENTS`, `INTEREST_ONLY`) y agrega `schedule_type` a `loans`                                                                                               |
| `20260907224500_composite_client_id_number`                          | Cambia unique de `id_number` (solo) a compuesto `(user_id, id_number)` — permite mismo CI entre usuarios distintos                                                                                    |
| `20260911010000_add_discount_applied_to_payment_installments`        | Agrega `discount_applied` a `payment_installments` (pre-reestructuración)                                                                                                                             |
| `20260911023000_restructure_payment_installments_explicit_breakdown` | **Reestructura** `payment_installments`: reemplaza `amount_applied`/`discount_applied` por `interest_paid`, `capital_paid`, `interest_discounted`, `capital_discounted`. Backfill de datos históricos |
| `20260911032000_backfill_historical_payment_installments`            | Recalcula desgloses históricos en pagos donde interest_paid y capital_paid quedaron en 0                                                                                                              |
| `20260911033000_fix_backfill_payment_installments`                   | Corrige sobre-asignación de capital en pagos históricos donde la suma de links excedía el monto del pago                                                                                              |
| `20260914144933_add_cascade_delete_loan_relations`                   | Agrega `ON DELETE CASCADE` a las 6 FKs que referencian `loans`: installments, payments, payment_installments (×2), loan_guarantees, loan_refinances                                                   |

---

## Zonas horarias y timestamps

La aplicación **almacena y transmite todo en UTC**, y reserva `America/La_Paz` (UTC-4) para la **presentación** (mostrar fechas al usuario en el frontend y cálculos de "hoy" en la capa de aplicación). PostgreSQL guarda el instante absoluto; las marcas temporales son `TIMESTAMPTZ` (UTC interno).

Cómo se implementa:

- **Almacenamiento/sesión en UTC**: `src/prisma/prisma.service.ts` crea el `Pool` de `pg` **sin forzar zona horaria** (la sesión queda en UTC, el default de PostgreSQL).
- **`src/main.ts`**: fija `process.env.TZ = 'America/La_Paz'` para que los cálculos de "día actual" en la capa de aplicación (`getTodayLaPaz()`, cron de mora, etc.) usen el día de negocio boliviano.
- **Columnas de marca temporal** son `TIMESTAMPTZ(3)` (`@db.Timestamptz(3)` en Prisma).
- **Columnas de solo fecha** (`@db.Date`): `Loan.startDate`, `Loan.firstDueDate`, `Installment.dueDate`, `Payment.paymentDate`.

## Fuente de verdad de los pagos

La **única fuente de verdad es la fecha de pago (`Payment.paymentDate`)** que envía el frontend. El `Installment.paidAt` es un metadato de auditoría (cuándo procesó el backend), **no** la fuente de verdad de la fecha de pago.

---

## Configuración de Migraciones (Prisma 7)

```typescript
// prisma.config.ts
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

### Comandos de Base de Datos (pnpm)

```bash
pnpm exec prisma db seed              # Ejecutar seed
pnpm exec prisma migrate dev --name x # Crear + aplicar migración en dev
pnpm exec prisma migrate deploy       # Aplicar pendientes (producción)
pnpm exec prisma migrate status       # Ver estado
pnpm exec prisma db push              # Sync sin migración (dev local solamente)
```

### Estrategia de Migraciones en Producción

> [!WARNING]
> `prisma db push` modifica la BD **SIN registrar historial en `_prisma_migrations`**.
> `prisma migrate deploy` **REQUIERE** esa tabla. Si se ejecuta `db push` primero, hay que hacer `baseline` con `migrate resolve --applied`.

### Solución P3005 (baseline sin pérdida de datos)

```bash
pnpm exec prisma migrate resolve --applied 20260615150807_init
pnpm exec prisma migrate resolve --applied 20260818012602_add_fortnightly_period
pnpm exec prisma migrate resolve --applied 20260827181308_timestamps_timestamptz
pnpm exec prisma migrate resolve --applied 20260830153853_add_discount_amount_to_payments
pnpm exec prisma migrate resolve --applied 20260831012844_add_schedule_type_to_loans
pnpm exec prisma migrate resolve --applied 20260907224500_composite_client_id_number
pnpm exec prisma migrate resolve --applied 20260911010000_add_discount_applied_to_payment_installments
pnpm exec prisma migrate resolve --applied 20260911023000_restructure_payment_installments_explicit_breakdown
pnpm exec prisma migrate resolve --applied 20260911032000_backfill_historical_payment_installments
pnpm exec prisma migrate resolve --applied 20260911033000_fix_backfill_payment_installments
pnpm exec prisma migrate resolve --applied 20260914144933_add_cascade_delete_loan_relations
```

**Resultado:** Prisma creará la tabla `_prisma_migrations`, registrará las migraciones en el historial sin tocar ninguna fila existente, y desbloqueará inmediatamente el CI/CD de GitHub Actions.

---

## Tablas post-MVP (no implementar ahora)

- `visit_logs` — registro de visitas de cobro sin éxito
- `capital_movements` — control de inyecciones de capital y retiro de utilidades
- `whatsapp_templates` — los mensajes de WhatsApp son hardcodeados en el frontend para el MVP
