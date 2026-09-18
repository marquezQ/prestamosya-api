# ARCHITECTURE.md — prestamosya-api

Documento de arquitectura del backend. Describe la estructura de carpetas, el patrón estándar de NestJS y la Clean Architecture aplicada al módulo `loans`.

---

## Estructura de carpetas

```
src/
  modules/
    auth/                          ← estándar NestJS (SOLO autenticación: quién soy)
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      auth.service.spec.ts
      auth.docs.ts
      decorators/
        current-user.decorator.ts
        public.decorator.ts
      dto/
        auth-response.dto.ts
        login.dto.ts
      guards/
        jwt-auth.guard.ts
      interfaces/
        jwt-payload.interface.ts
      strategies/
        jwt.strategy.ts
        jwt.strategy.spec.ts

    users/                         ← estándar NestJS (mi cuenta / self-service)
      users.module.ts
      users.controller.ts
      users.service.ts
      users.service.spec.ts
      users.docs.ts
      dto/
        user-response.dto.ts
        update-profile.dto.ts    ← reservado para PATCH /users/:id (super admin, futuro)
        change-password.dto.ts

    business-config/               ← estándar NestJS (dominio propio, 1:1 con User)
      business-config.module.ts
      business-config.controller.ts
      business-config.service.ts
      business-config.service.spec.ts
      business-config.docs.ts
      dto/
        business-config-response.dto.ts
        update-business-config.dto.ts

    clients/                       ← estándar NestJS
      clients.module.ts
      clients.controller.ts
      clients.service.ts
      clients.service.spec.ts
      clients.docs.ts
      dto/
        create-client.dto.ts
        update-client.dto.ts
        client-response.dto.ts

    loans/                         ← Clean Architecture
      loans.module.ts
      loans.docs.ts
      domain/
        entities/
          loan.entity.ts
          loan.entity.spec.ts
          installment.entity.ts
          installment.entity.spec.ts
        enums/
          index.ts
          installment-status.enum.ts
          loan-mode.enum.ts
          loan-schedule-type.enum.ts
          loan-status.enum.ts
          period-type.enum.ts
        errors/
          loan-domain.errors.ts
        repositories/
          installment.repository.ts
          loan.repository.ts
          payment.repository.ts
        services/
          loan-calculator.service.ts
          loan-calculator.service.spec.ts
        value-objects/
          money.vo.ts
          money.vo.spec.ts
      application/
        ports/
          unit-of-work.port.ts
        use-cases/
          create-loan.use-case.ts
          create-loan.use-case.spec.ts
          simulate-loan.use-case.ts
          get-loan-detail.use-case.ts
          register-payment.use-case.ts
          register-payment.use-case.spec.ts
          void-payment.use-case.ts
          void-payment.use-case.spec.ts
          settle-loan.use-case.ts
          settle-loan.use-case.spec.ts
          link-guarantee.use-case.ts
          link-guarantee.use-case.spec.ts
          unlink-guarantee.use-case.ts
          get-payment-dashboard.use-case.ts
      infrastructure/
        loans.controller.ts
        prisma-unit-of-work.ts
        mappers/
          installment.mapper.ts
          loan.mapper.ts
        repositories/
          prisma-installment.repository.ts
          prisma-loan.repository.ts
          prisma-payment.repository.ts
      dto/
        create-loan.dto.ts
        simulate-loan.dto.ts
        link-guarantee.dto.ts
        loan-detail-response.dto.ts
        loan-response.dto.ts

    payments/                      ← estándar NestJS (sin service propio)
      payments.module.ts
      payments.controller.ts
      payments.docs.ts
      dto/
        register-payment.dto.ts
        void-payment.dto.ts
        settle-loan.dto.ts
        query-payment-dashboard.dto.ts

    guarantees/                    ← estándar NestJS
      guarantees.module.ts
      guarantees.controller.ts
      guarantees.service.ts
      guarantees.service.spec.ts
      guarantees.docs.ts
      dto/
        create-guarantee.dto.ts
        update-guarantee.dto.ts
        guarantee-response.dto.ts

    dashboard/                     ← estándar NestJS + use-case
      dashboard.module.ts
      dashboard.controller.ts
      dashboard.docs.ts
      application/
        use-cases/
          get-home-dashboard.use-case.ts
          get-home-dashboard.use-case.spec.ts
      dto/
        home-dashboard-response.dto.ts

    stats/                         ← estándar NestJS
      stats.module.ts
      stats.controller.ts
      stats.service.ts
      stats.service.spec.ts
      stats.docs.ts
      dto/
        monthly-stats-response.dto.ts
        monthly-history-response.dto.ts
        query-monthly-stats.dto.ts
        query-monthly-history.dto.ts

    cron/                          ← estándar NestJS + @nestjs/schedule
      cron.module.ts
      cron.controller.ts
      cron.docs.ts
      overdue.cron.ts
      services/
        overdue-processor.service.ts
        overdue-processor.service.spec.ts

  common/
    cloudinary/                    ← @Global(), inyectable en cualquier módulo
      cloudinary.module.ts
      cloudinary.service.ts
    types/
      prisma.types.ts              ← PrismaClientLike / PrismaTransactionClient
    utils/
      date.utils.ts                ← getTodayLaPaz, subDays, calculateDaysOverdue

  prisma/
    prisma.module.ts               ← @Global()
    prisma.service.ts

  testing/
    prisma.mock.ts                 ← createPrismaMock, prismaServiceOf, lastCallArg

  generated/
    prisma/                        ← gitignored, generado por Prisma v7

  main.ts
  app.module.ts
  app.controller.ts
  app.service.ts
```

---

## Módulos globales

- **`PrismaModule`** (`src/prisma/prisma.module.ts`): `@Global()` — `PrismaService` inyectable en todos los módulos sin importarlo explícitamente.
- **`CloudinaryModule`** (`src/common/cloudinary/cloudinary.module.ts`): `@Global()` — `CloudinaryService` inyectable en cualquier módulo. Sube y optimiza imágenes de garantías a Cloudinary.

---

## Registro global de guardia — `AppModule`

```typescript
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,  // Todas las rutas protegidas por defecto
}
```

Todas las rutas requieren JWT excepto las marcadas con `@Public()` (actualmente solo `POST /api/auth/login`).

> **Separación de responsabilidades por módulo:**
> - `auth` = **autenticación** (quién soy): login, token JWT, guards, estrategias, decoradores.
> - `users` = **mi cuenta** (self-service): `GET /users/me`, `PATCH /users/me/password`.
>   - `PATCH /users/me` (editar nombre) **NO existe**: el nombre lo establece el super admin al crear la cuenta
>     y lo editará vía `PATCH /users/:id` (futuro). `update-profile.dto.ts` se mantiene para ese uso.
> - `business-config` = **dominio propio** (config 1:1 con User): `GET/PATCH /business-config`.
> - No mezclar dominios en `auth`: si una operación es "sobre mi usuario/cuenta" va a `users`; si es la config del negocio, va a `business-config`.

---

## Arquitectura estándar NestJS (todos los módulos excepto loans)

```
module.ts       ← importa y exporta
controller.ts   ← recibe request, valida con DTOs, llama al service/use-case
service.ts      ← lógica de negocio, accede a Prisma directamente
dto/            ← un archivo por DTO (create, update, response, query)
```

**Regla:** El controller **no contiene lógica de negocio**. Solo recibe, valida y delega.
El service **no conoce Request ni Response** de HTTP. Solo recibe parámetros tipados.

### Excepción: módulo `payments`

`payments` **no tiene service propio**. El `PaymentsController` importa y llama directamente los use-cases exportados desde `LoansModule` (`RegisterPaymentUseCase`, `VoidPaymentUseCase`, `SettleLoanUseCase`, `GetPaymentDashboardUseCase`). El módulo es solo un contenedor HTTP que delega toda la lógica al módulo financiero.

---

## Clean Architecture en el módulo `loans`

### Por qué solo en loans

`loans` contiene la lógica más compleja y crítica del sistema: cálculo de cuotas, manejo de redondeo financiero, generación de cronogramas, pagos FIFO, liquidación anticipada y refinanciamiento. Esta lógica tiene que ser testeable de forma completamente aislada, sin base de datos, sin NestJS, con TypeScript puro. Los demás módulos son CRUD con algo de validación — Clean Architecture sería sobreingeniería innecesaria.

### Las capas y qué hace cada una

**Domain** — el corazón. No importa nada de NestJS, Prisma, ni HTTP. Solo TypeScript puro.

- **Entidades** (`entities/`): `LoanEntity` (raíz del agregado) y `InstallmentEntity` con métodos de negocio puros: `applyPayment()`, `revertPayment()`, `settleEarly()`, `markAsRefinanced()`, `recalculateStatus()`, `archive()`.
- **Value Objects** (`value-objects/`): `Money` — inmutable, protegido contra coma flotante (usa `decimal.js`), prohíbe mezclar monedas.
- **Enums** (`enums/`): `LoanStatus`, `InstallmentStatus`, `LoanScheduleType`, `PeriodType`, `LoanMode`.
- **Repositorios** (`repositories/`): Interfaces abstractas (`LoanRepository`, `InstallmentRepository`, `PaymentRepository`). No saben que existe Prisma.
- **Servicios de dominio** (`services/`): `LoanCalculatorService` — genera cronogramas de cuotas (EQUAL_INSTALLMENTS e INTEREST_ONLY), calcula fechas de vencimiento, absorción de redondeo en la última cuota.
- **Errores** (`errors/`): 8 clases de error de dominio (ej. `PaymentExceedsBalanceError`, `LoanNotActiveError`, `CurrencyMismatchError`).

**Application** — orquesta el dominio. Conoce los repositorios (por interfaz) pero no sabe que existe Prisma.

- **Puertos** (`ports/`): `UnitOfWork` — abstracción transaccional genérica.
- **Use-cases** (`use-cases/`): 10 casos de uso implementados. Cada uno encapsula una operación de negocio completa.

**Infrastructure** — la única capa que conoce Prisma y HTTP. Implementa los contratos del dominio.

- **Repositorios** (`infrastructure/repositories/`): `PrismaLoanRepository`, `PrismaInstallmentRepository`, `PrismaPaymentRepository`.
- **UnitOfWork** (`infrastructure/prisma-unit-of-work.ts`): Implementación con `prisma.$transaction()` interactive. Crea instancias transaccionales de los 3 repositorios.
- **Mappers** (`infrastructure/mappers/`): Conversión Prisma ↔ Entidades de dominio (Decimal ↔ Money) y dominio ↔ Response DTO.
- **Controller** (`infrastructure/loans.controller.ts`): Rutas REST. Maneja errores de dominio → `BadRequestException`.

### Inyección de dependencias en loans.module.ts

> [!WARNING]
> **Bug de DI con TypeScript y NestJS:**
> Los repositorios de infraestructura usan `PrismaClientLike` (un type alias) en su constructor en lugar de `PrismaService`, para poder ser instanciados tanto por Nest (con el service global) como por el UnitOfWork (con el `tx` transaccional).
> Sin embargo, TypeScript emite metadatos (`reflect-metadata`) para los alias como `Object`. Esto causa que NestJS lance `UnknownDependenciesException` al usar `useClass`.
> **Solución:** Siempre debes usar `useFactory` e inyectar explícitamente el `PrismaService` cuando registres estos repositorios en el módulo.

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [LoansController],
  providers: [
    LoanCalculatorService,
    CreateLoanUseCase,
    SimulateLoanUseCase,
    LinkGuaranteeUseCase,
    UnlinkGuaranteeUseCase,
    GetLoanDetailUseCase,
    RegisterPaymentUseCase,
    VoidPaymentUseCase,
    GetPaymentDashboardUseCase,
    SettleLoanUseCase,
    {
      provide: LoanRepository,
      useFactory: (prisma: PrismaService) => new PrismaLoanRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: InstallmentRepository,
      useFactory: (prisma: PrismaService) => new PrismaInstallmentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: PaymentRepository,
      useFactory: (prisma: PrismaService) => new PrismaPaymentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: UnitOfWork,
      useClass: PrismaUnitOfWork,
    },
  ],
  exports: [
    CreateLoanUseCase,
    RegisterPaymentUseCase,
    VoidPaymentUseCase,
    GetPaymentDashboardUseCase,
    SettleLoanUseCase,
    UnitOfWork,
    LoanRepository,
    InstallmentRepository,
    PaymentRepository,
  ],
})
export class LoansModule {}
```

Los use-cases exportados son consumidos por `PaymentsModule` (su controller llama directamente a los use-cases de loans).

### Lo que NUNCA debe pasar en `domain/`

- Ningún `import` de `@prisma/client` o `../../generated/prisma`
- Ningún `import` de `@nestjs/*`
- Ningún acceso a variables de entorno
- Ninguna llamada HTTP

Si alguno de estos aparece en `domain/`, es un **error de arquitectura**.

---

## Módulo `cron` — Tarea programada de mora

- `OverdueCron` (`overdue.cron.ts`): `@Cron('0 6 * * *', { timeZone: 'America/La_Paz' })` — ejecuta diario a las 6:00 AM La Paz.
- `OverdueProcessorService` (`services/overdue-processor.service.ts`): Lógica de procesamiento reutilizable. Calcula `daysOverdue`, marca cuotas `OVERDUE`, actualiza `ClientStatus` (`CURRENT`/`DELINQUENT`). Respetando `graceDays` de `business_config`.
- `CronController` (`cron.controller.ts`): Endpoint de fallback `POST /api/admin/recalculate-overdue` para forzar el recálculo manualmente.

---

## Módulo `dashboard` — Métricas del Home

Patrón híbrido: usa un use-case (`GetHomeDashboardUseCase`) en `application/use-cases/` pero el módulo no tiene Clean Architecture completa. El use-case accede directamente a PrismaService (sin repositorio intermedio). Retorna `capitalEnCalle` (BOB/USD), `loansSummary`, `clientsSummary`, `overdueInstallments` y `generatedAt`.

---

## Módulo `stats` — Reportes financieros

`StatsService` contiene la lógica de `getMonthlyStats` (5 secciones: period, incomeBreakdown, performanceSummary, riskIndicators, monthlyBalance) y `getMonthlyHistory` (arreglo cronológico para gráficas). Usa `getTodayLaPaz()` para calcular el período actual. Maneja multi-moneda sin mezclar BOB/USD.

---

## Módulo `guarantees` — CRUD con Cloudinary

Estándar NestJS con `GuaranteesService`. Acepta `multipart/form-data` via `FileInterceptor` (multer `memoryStorage`). Sube imágenes a Cloudinary optimizadas a WebP (800×800px, quality 80) en la carpeta `{user.name}/garantias/`. Soft delete con protección `IN_USE`.

---

## Convertir Prisma Decimal ↔ Money

**Al leer de Prisma** (en mappers):
```typescript
Money.of(new Decimal(raw.capitalAmount.toString()), currency)
```

**Al escribir a Prisma** (en mappers):
```typescript
entity.capitalAmount.toString()  // → "1000.00" (string para Prisma Decimal)
```

**En respuestas de la API:**
- `LoanResponseDto`: montos como **string** con 2 decimales (para que el frontend haga parsing controlado).
- `LoanDetailResponseDto` / `ClientProfileResponseDto`: montos como **number** (via `Number()`) para consumo inmediato.
