# ARCHITECTURE.md — prestamosya-api

Documento de arquitectura del backend. Describe la estructura de carpetas, el patrón estándar de NestJS y la Clean Architecture aplicada al módulo `loans`.

---

## Estructura de carpetas

```
src/
  modules/
    auth/                          ← estándar NestJS
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      strategies/
        jwt.strategy.ts
        jwt-refresh.strategy.ts
      guards/
        jwt.guard.ts
        roles.guard.ts
      dto/
        login.dto.ts
        refresh-token.dto.ts

    clients/                       ← estándar NestJS
      clients.module.ts
      clients.controller.ts
      clients.service.ts
      dto/
        create-client.dto.ts
        update-client.dto.ts
        client-response.dto.ts

    loans/                         ← Clean Architecture
      loans.module.ts
      domain/
        entities/
          loan.entity.ts           ← clase Loan con métodos de negocio puros
          installment.entity.ts    ← clase Installment con lógica de estado
        repositories/
          loan.repository.ts       ← interfaz (contrato) — solo TypeScript, sin Prisma
        services/
          loan-calculator.service.ts  ← cálculo de cuotas, redondeo — solo TypeScript
      application/
        use-cases/
          create-loan.use-case.ts
          calculate-installments.use-case.ts
          refinance-loan.use-case.ts
      infrastructure/
        prisma-loan.repository.ts  ← implementa loan.repository.ts usando Prisma
        loans.controller.ts        ← recibe HTTP, llama a los use-cases
      dto/
        create-loan.dto.ts
        refinance-loan.dto.ts
        loan-response.dto.ts

    installments/                  ← estándar NestJS
      installments.module.ts
      installments.controller.ts
      installments.service.ts
      dto/

    payments/                      ← estándar NestJS por ahora
      payments.module.ts           ← puede migrar parcialmente a Clean Architecture
      payments.controller.ts       ← si la complejidad lo requiere a futuro
      payments.service.ts
      dto/

    guarantees/                    ← estándar NestJS
      guarantees.module.ts
      guarantees.controller.ts
      guarantees.service.ts
      dto/

    dashboard/                     ← estándar NestJS
      dashboard.module.ts
      dashboard.controller.ts
      dashboard.docs.ts
      application/
        use-cases/
          get-home-dashboard.use-case.ts
      dto/
        home-dashboard-response.dto.ts

    stats/                         ← estándar NestJS
      stats.module.ts
      stats.controller.ts
      stats.service.ts

    config/                        ← estándar NestJS
      config.module.ts
      config.controller.ts
      config.service.ts

    cron/                          ← estándar NestJS
      cron.module.ts
      overdue.cron.ts

  common/
    decorators/
      current-user.decorator.ts
      roles.decorator.ts
    filters/
      http-exception.filter.ts
    interceptors/
      response.interceptor.ts
    guards/

  prisma/
    prisma.module.ts
    prisma.service.ts

  main.ts
  app.module.ts
```

---

## Arquitectura estándar NestJS (todos los módulos excepto loans)

```
module.ts       ← importa e exporta
controller.ts   ← recibe request, valida con DTOs, llama al service
service.ts      ← lógica de negocio, accede a Prisma directamente
dto/            ← un archivo por DTO (create, update, response, query)
```

**Regla:** El controller **no contiene lógica de negocio**. Solo recibe, valida y delega.
El service **no conoce Request ni Response** de HTTP. Solo recibe parámetros tipados.

```typescript
// clients.service.ts — accede a Prisma directamente, sin repositorio intermedio
@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: ClientsQueryDto) {
    return this.prisma.client.findMany({
      where: {
        deletedAt: null,
        status: params.status,
      },
    });
  }
}
```

---

## Clean Architecture en el módulo `loans`

### Por qué solo en loans

`loans` contiene la lógica más compleja y crítica del sistema: cálculo de cuotas, manejo de redondeo financiero, generación de cronogramas y refinanciamiento. Esta lógica tiene que ser testeable de forma completamente aislada, sin base de datos, sin NestJS, con TypeScript puro. Los demás módulos son CRUD con algo de validación — Clean Architecture sería sobreingeniería innecesaria.

**Regla crítica:** No aplicar Clean Architecture en ningún otro módulo a menos que se decida explícitamente. `auth`, `clients`, `payments`, `dashboard`, `stats`, `config` y `cron` usan arquitectura estándar.

### Las capas y qué hace cada una

**Domain** — el corazón. No importa nada de NestJS, Prisma, ni HTTP. Solo TypeScript puro.

```typescript
// domain/entities/loan.entity.ts
export class LoanEntity {
  constructor(
    public readonly id: string,
    public readonly capitalAmount: number,
    public readonly interestRate: number,
    public readonly totalInstallments: number,
    public readonly currency: 'BOB' | 'USD',
    public outstandingBalance: number,
    public status: LoanStatus,
  ) {}

  isActive(): boolean {
    return this.status === LoanStatus.ACTIVE;
  }

  canBeRefinanced(): boolean {
    return this.status === LoanStatus.ACTIVE && this.outstandingBalance > 0;
  }

  applyPayment(amount: number): void {
    if (amount > this.outstandingBalance) {
      throw new Error('El pago supera el saldo pendiente');
    }
    this.outstandingBalance -= amount;
    if (this.outstandingBalance === 0) {
      this.status = LoanStatus.COMPLETED;
    }
  }
}
```

```typescript
// domain/repositories/loan.repository.ts
// Contrato puro — no sabe que existe Prisma
export interface LoanRepository {
  findById(id: string): Promise<LoanEntity | null>;
  findByClientId(clientId: string): Promise<LoanEntity[]>;
  save(loan: LoanEntity): Promise<LoanEntity>;
  update(loan: LoanEntity): Promise<LoanEntity>;
}
```

```typescript
// domain/services/loan-calculator.service.ts
// Lógica financiera pura — sin inyección de dependencias de NestJS
export class LoanCalculatorService {
  calculateInstallments(
    capital: number,
    interestRate: number,
    totalInstallments: number,
    startDate: Date,
    periodType: PeriodType,
  ): InstallmentEntity[] {
    // cálculo puro, sin tocar BD
    // la última cuota absorbe la diferencia de redondeo
  }
}
```

**Application** — orquesta el dominio. Conoce el repositorio (por interfaz) pero no sabe que existe Prisma.

```typescript
// application/use-cases/create-loan.use-case.ts
export class CreateLoanUseCase {
  constructor(
    private readonly loanRepository: LoanRepository,  // ← interfaz, no implementación
    private readonly calculator: LoanCalculatorService,
  ) {}

  async execute(input: CreateLoanInput): Promise<LoanEntity> {
    const installments = this.calculator.calculateInstallments(
      input.capitalAmount,
      input.interestRate,
      input.totalInstallments,
      input.startDate,
      input.periodType,
    );
    const loan = new LoanEntity(...);
    return this.loanRepository.save(loan);
  }
}
```

**Infrastructure** — la única capa que conoce Prisma. Implementa el contrato del repositorio.

```typescript
// infrastructure/prisma-loan.repository.ts
@Injectable()
export class PrismaLoanRepository implements LoanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<LoanEntity | null> {
    const raw = await this.prisma.loan.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toEntity(raw);
  }

  async save(loan: LoanEntity): Promise<LoanEntity> {
    const raw = await this.prisma.loan.create({ data: this.toPrisma(loan) });
    return this.toEntity(raw);
  }

  private toEntity(raw: PrismaLoan): LoanEntity { ... }
  private toPrisma(entity: LoanEntity): Prisma.LoanCreateInput { ... }
}
```

**Inyección de dependencias en loans.module.ts:**

> [!WARNING]
> **Bug de DI con TypeScript y NestJS:**
> Los repositorios de infraestructura usan `PrismaClientLike` (un type alias) en su constructor en lugar de `PrismaService`, para poder ser instanciados tanto por Nest (con el service global) como por el UnitOfWork (con el `tx` transaccional).
> Sin embargo, TypeScript emite metadatos (`reflect-metadata`) para los alias como `Object`. Esto causa que NestJS lance `UnknownDependenciesException` al usar `useClass`. 
> **Solución:** Siempre debes usar `useFactory` e inyectar explícitamente el `PrismaService` cuando registres estos repositorios en el módulo.

```typescript
@Module({
  providers: [
    LoanCalculatorService,
    CreateLoanUseCase,
    RefinanceLoanUseCase,
    CalculateInstallmentsUseCase,
    {
      provide: LoanRepository,         // ← token = interfaz
      useFactory: (prisma: PrismaService) => new PrismaLoanRepository(prisma),
      inject: [PrismaService],         // ← inyección manual segura
    },
  ],
  controllers: [LoansController],
})
export class LoansModule {}
```

### Lo que NUNCA debe pasar en `domain/`

- Ningún `import` de `@prisma/client`
- Ningún `import` de `@nestjs/*`
- Ningún acceso a variables de entorno
- Ninguna llamada HTTP

Si alguno de estos aparece en `domain/`, es un **error de arquitectura**.
