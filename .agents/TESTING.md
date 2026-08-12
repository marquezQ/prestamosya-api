# TESTING.md — prestamosya-api

Estrategia de testing acordada, decisiones de stack, criterio de qué testeamos y por qué, y plan de implementación paso a paso.

---

## 1. Principio rector (léelo primero)

**No testemos líneas de código: testemos *invariantes* y *contratos*.**

Un test vale por el daño que evita, no por las líneas que ejecuta. Cada test debe responder a una pregunta del tipo:
_"¿Qué es lo que nadie tiene permitido romper en este módulo?"_

Tres conductas que definen a un buen tester:

1. **No probar plomería.** Un controller que solo delega (recibe → valida con el pipe global → llama al service → devuelve `{data}`) casi nunca merece unit test. Postman ya lo valida.
2. **No probar código trivial.** El `create` de un CRUD que mapea un DTO a un insert no necesita cinco casos.
3. **Sí probar toda lógica con decisiones y casos borde.** Redondeo, mora, saldos, anulación, cambio de moneda, duplicados, permisos cross-admin, contratos de seguridad (nunca exponer `passwordHash`).

> En la práctica para este proyecto, el valor se concentra en **`ClientsService.findOne`** (resumen financiero) y **`AuthService`** (seguridad). El resto de métodos del CRUD reciben cobertura ligera.

---

## 2. Stack (DECIDIDO — reemplaza el "POR DECIDIR" anterior)

| Capa | Herramienta | Estado |
|------|------------|--------|
| Framework de test | **Jest** | ✅ ya instalado (`jest`, `ts-jest`) |
| Testing module NestJS | **@nestjs/testing** | ✅ ya instalado |
| E2E HTTP | **supertest** | ✅ ya instalado (`test/jest-e2e.json`) |
| Mocks de Prisma | **Mock manual** (objeto de `jest.fn()`) | Sin dependencias extra |
| Coverage | `jest --coverage` | Configurado |

**No hacer:** no instalar Vitest ni frameworks alternativos. Jest ya está integrado y es el estándar de NestJS. La decisión del `@golevelup/ts-jsmock` o `prismock` se re-evalúa **solo si** el mock manual de Prisma se vuelve insoportable cuando lleguemos a `payments` (con `$transaction`).

---

## 3. Pirámide de testing y cuándo usar cada nivel

```
       / E2E  \         (hay pocos, cubren el flujo feliz integrado, lentos, necesitan BD)
      / integra |       (unen piezas reales, entre unit y e2e)
     / UNIT ... |       (hay muchos, rápidos, NO necesitan BD)
    /------------|      (prueban lógica + invariantes)
```

### Unit test (`.spec.ts`, junto al archivo)
- **Sin base de datos, sin HTTP, sin arrancar el servidor.**
- Se mockean las dependencias externas: `PrismaService`, `JwtService`, etc.
- Se prueban reglas de negocio y contratos.
- Son rápidos (milisegundos) → se ejecutan en cada `pnpm run test` (usa `testRegex .*\.spec\.ts$`, `rootDir: src`).

### Test de integración
- **Sí** se comunica con una dependencia real, p. ej. **una BD PostgreSQL real** (sin mockear el repository).
- Aquí encaja el futuro `PrismaLoanRepository` (Clean Architecture de `loans`) y cualquier consulta compleja de Prisma (joins, agrupación).
- Se separa (p. ej. con tags) porque es más lento y necesita entorno.
- **Decisión:** se difiere hasta que exista el módulo `loans`.

### E2E (`test/*.e2e-spec.ts`, con supertest)
- Arranca la app NestJS completa (`Test.createTestingModule({ imports:[AppModule] })`), levanta la **BD real** y dispara requests por socket HTTP.
- Valida el flujo integrado: `POST /api/auth/login` → token → `GET /api/auth/me`, CRUD real de `/api/clients`, envelope `{ data, message }`, códigos HTTP, auth Bearer.
- Se ejecutan con `pnpm run test:e2e`.
- Requieren una BD: ver sección 5.

---

## 4. Estrategia por módulo (estado actual: auth y clients)

### Módulo `auth`
| Unidad | Tipo | Prioridad | Qué cubrir |
|--------|------|-----------|-----------|
| `auth.service` | Unit | 🔴 Alto | login exitoso (devuelve token + user **sin `passwordHash`**), usuario inexistente → 401, usuario inactivo → 401, contraseña incorrecta → 401, payload firmado `{ sub, username, role }` |
| `jwt.strategy` | Unit | 🟡 Medio | `validate` con `sub` → devuelve payload; sin `sub` → `UnauthorizedException` |
| `jwt-auth.guard` | Unit | 🟢 Bajo | comportamiento con las rutas `@Public()` |
| `auth.controller` | — | Debería no | pura delegación, no aporta valor |

### Módulo `clients`
| Unidad | Tipo | Prioridad | Qué cubrir |
|--------|------|-----------|-----------|
| `clients.service.findOne` | **Unit** | 🔴 **Alta** | resumen financiero: separación USD/BOB, conteo y monto OVERDUE, `nextInstallment`, `pendingAmount` (con `Math.max(0, …)`), Decimal → number, redondeo, scoping por `userId` (no existe / otro admin → 404) |
| `clients.service.create` | **Unit** | 🔴 **Alta** | pasa los campos correctos, CI duplicado (Prisma `P2002`) → `ConflictException`, normaliza Decimal en latitud/longitud |
| `clients.service.update` | **Unit** | 🟡 Media-Alta | solo los campos presentes (los `undefined` no se incluyen), `P2002` → Conflict |
| `clients.service.remove` | **Unit** | 🟡 Media | soft-delete: setea `deletedAt` (no borrado físico) |
| `clients.service.findAll` | **Unit** | 🟢 Media | filtra por `userId` y `deletedAt: null`, devuelve `{ data }` |
| `clients.controller` | — | ⛔ no | plomería |
| DTOs | E2E | 🟢 | validación (pipe global), no unit test dedicado |

### Módulo `loans` (Clean Architecture)
| Unidad | Tipo | Prioridad | Qué cubrir |
|--------|------|-----------|-----------|
| `Money.vo` | **Unit** | 🔴 **Alta** | Operaciones matemáticas con `decimal.js`, inmutabilidad, errores por mezclar diferentes monedas, redondeo y formateo estricto. |
| `LoanCalculatorService` | **Unit** | 🔴 **Alta** | Generación de cuotas (Automático), cálculo preciso de fechas (mensual/semanal), distribución de capital, y especialmente **absorción de redondeo en la última cuota**. |
| `LoanEntity` & `InstallmentEntity` | **Unit** | 🔴 **Alta** | Invariantes puros del negocio: instanciación de cuotas, cálculos de pagos, transiciones de estado, validación de refinanciamiento. |
| `CreateLoanUseCase` | **Unit** | 🟡 Media-Alta | Validaciones de creación, llamadas a los servicios de dominio, manejo de transacciones vía `UnitOfWork`. |
| `LoansController` & Repositories | — | ⛔ no | Probados directamente a través de tests E2E y de integración. |

---

## 5. Cómo mockear PrismaService (recomendado)

`PrismaService` **abre un Pool real en el constructor** y **extiende `PrismaClient`** → **nunca lo instanciamos real en unit tests** (si no, intenta conectar a la BD en cada spec). Sustituir por un mock de `jest.fn()`.

### Mock manual (sin dependencias adicionales)
```ts
const prismaMock = {
  user: { findUnique: jest.fn() },
  client: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    $transaction: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};
```
- Registrar en un `TestingModule` con `.overrideProvider(PrismaService)`, o inyectarlo manualmente vía `new ClientsService(prismaMock as any)`.
- **En cada test se resetean** las funciones del mock (`beforeEach`) para no arrastrar estado entre casos.

> Nota: como Prisma v7 genera el cliente en `src/generated/prisma`, los enums (`LoanStatus`, `InstallmentStatus`, etc.) se importan desde ahí — ya se hace así en `clients.service.ts`.

---

## 6. Base de datos para los tests

| Tipo de test | ¿Necesita BD? | Qué se usa |
|--------------|---------------|-----------|
| **Unit** | ❌ No | mocks |
| **Integración** (futuro, loans) | ✅ Sí | BD real de test |
| **E2E** | ✅ Sí | BD real de test |

### Decisiones para E2E
- **No** usar la BD de desarrollo (`prestamosya`): se llena con datos de test y rompe el entorno real.
- **No** montar Docker para testing en el MVP (consistente con "sin Docker en producción"; recursos limitados del VPS).
- **Solución:** una **BD PostgreSQL separada** llamada `prestamosya_test` en la misma instancia local, señalada con `TEST_DATABASE_URL`.

### Pasos requeridos (se ejecutan en el paso 5 del plan)
1. Añadir `TEST_DATABASE_URL` a `.env` y `.env.example` — **nunca commitear el `.env`**.
2. Crear la BD `prestamosya_test`.
3. Antes de correr E2E, aplicar el esquema al entorno de test:
   - `DATABASE_URL=<TEST_DATABASE_URL> pnpm exec prisma migrate deploy`
   - seed (`pnpm exec prisma db seed`) para tener datos base (admin).
4. Un script npm dedicado (p. ej. `pretest:e2e`) orquesta todo.

> Alternativa más limpia a largo plazo: estrategia de *rollback por test* (helper que envuelve cada test en una transacción y hace rollback) para aislar por test. No se adopta ahora por simplicidad, se documenta como opción.

---

## 7. Convenciones de archivos y ejecución

```
src/modules/auth/auth.service.spec.ts        (unit)
src/modules/clients/clients.service.spec.ts  (unit)
test/auth.e2e-spec.ts                         (e2e)
test/clients.e2e-spec.ts                      (e2e)
```

- **Unit:** `describe('AuthService')` / `describe('ClientsService')`, un `spec` por clase, `beforeEach` de reset mocks, `it` que describe el **invariante** o el caso borde.
- **E2E:** `describe('Auth (e2e)')`, con `request(app.getHttpServer())`.
- Scripts (en `package.json`):
  - `pnpm test` → unit
  - `pnpm test:watch` → unit en modo watch
  - `pnpm test:cov` → unit + coverage
  - `pnpm test:e2e` → E2E (primero corre `pretest:e2e`, que migra y siembra la BD de test)
  - `pnpm test:all` → unit + E2E juntos

### Meta de cobertura (criterio senior, no ciego)
- **El 100% NO es objetivo** (perseguirlo infla tests de plomería sin valor).
- Meta pragmática: **> 70–80%** en `AuthService` y `ClientsService` (las clases con lógica) + **cada invariante crítico** de la sección 4 cubierto.
- Los controller sin lógica quedan fuera de la meta.

---

## 8. Prioridad en la implementación

| Nivel | Significado |
|-------|-------------|
| 🔴 | Imprescindible — invariante crítico, no hacer commit/push sin él |
| 🟡 | Importante — aumenta la facilidad de mantenimiento |
| 🟢 | Opcional / conveniencia |

---

## 9. Estado de implementación (Ejecutado: auth, clients, loans)

Unit y E2E de `auth` y `clients` implementados y en verde. Testing unitario completo del dominio y casos de uso del módulo `loans` (Clean Architecture). Queda pendiente E2E de `loans`, y el testing de los módulos futuros (payments, cron, garantías).

| Id | Qué | Archivos | Estado |
|----|-----|----------|--------|
| 1 | Harness Jest compilando módulos | `src/**/*.spec.ts` | ✅ |
| 2 | Unit `AuthService` | `src/modules/auth/auth.service.spec.ts` | ✅ |
| 3 | Unit `ClientsService` | `src/modules/clients/clients.service.spec.ts` | ✅ |
| 4 | Unit `JwtStrategy` | `src/modules/auth/strategies/jwt.strategy.spec.ts` | ✅ |
| 5 | BD de test + scripts | `scripts/setup-test-db.js`, `test/setup-e2e.ts` | ✅ |
| 6 | E2E `auth` | `test/auth.e2e-spec.ts` | ✅ |
| 7 | E2E `clients` | `test/clients.e2e-spec.ts` | ✅ |
| 8 | Unit Dominio `loans` | `src/modules/loans/domain/**/*.spec.ts` | ✅ |
| 9 | Unit Use Cases `loans`| `src/modules/loans/application/**/*.spec.ts`| ✅ |
| 10| Verificación general | — | ✅ |

**Resultado:** `86` tests unit + E2E en verde. Cobertura del dominio de `loans` cercana al 100%.

---

## 9bis. Plan para módulos futuros (loans, payments, cron)

El orden prioriza probar el costo de cada técnica en su momento y ver la utilidad real desde el inicio.

### Paso 4 — Preparación mínima
- [ ] Formalizar Jest como stack (hecho con este documento).
- [ ] Verificar que `pnpm test` corre limpio (aunque aún no haya `.spec`).
- [ ] (Opcional) Añadir `pnpm test:all` (unit + e2e).

**Criterio de salida:** `pnpm test` no falla.

### Paso 1 — Conectar Jest + smoke del harness
- [ ] Comprobar que `Test.createTestingModule` compila con `AuthModule`/`ClientsModule`.
- [ ] Escribir un test trivial de verificación del pipeline (plantilla, no lógica).

**Criterio de salida:** un spec dummy verde → el harness funciona antes de meter lógica.

### Paso 2 — Unit test de `AuthService` (🔴)
- [ ] Mockear `PrismaService` y `JwtService`.
- [ ] Casos:
  - login exitoso devuelve `{ accessToken, user }` y **user NO contiene `passwordHash`**.
  - usuario inexistente → `UnauthorizedException`.
  - usuario `isActive=false` → `UnauthorizedException`.
  - contraseña incorrecta → `UnauthorizedException`.
  - el payload firmado es `{ sub, username, role }` (spy sobre `jwtService.sign`).
- **Criterio de salida:** todos los casos en verde. **Utilidad vista en la práctica:** un refactor futuro que devuelva todo el objeto user sin filtrar quedará atrapado por el test de "no passwordHash".

### Paso 3 — Unit test de `clients.service` (🔴, el más valioso)
- [ ] Mockear `PrismaService`.
- **`findOne`**:
  - perfil con préstamos en BOB y USD → `financialSummary` agrupa por moneda sin mezclar.
  - `overdueInstallments` y `overdueAmount` correctos para cuota OVERDUE.
  - `nextInstallment` devuelve la primera no-PAID y `pendingAmount = total - paid` (≥ 0).
  - cliente de otro `userId` → `NotFoundException`.
  - Decimal → number y redondeo.
- **`create`**:
  - CI duplicado (`P2002`) → `ConflictException('ID number already exists')` (probar el catch exacto).
  - campos pasados al `data` correcto; lat/lon null.
- **`update`**:
  - solo campos presentes (undefined no se incluyen).
  - `P2002` en update → `ConflictException`.
- **`remove`**:
  - soft-delete: se setea `deletedAt`, no `delete`.
- **Criterio de salida:** `clients.service.spec` en verde.

**Utilidad visto en la práctica:** `findOne` con mora / multi-moneda / siguiente cuota es lo que Postman no deja probar en serio (casos borde). Y el `P2002` valida la UX de error.

### Paso 4 — Unit test de `jwt.strategy` (🟡)
- [ ] `validate` con payload válido → devuelve payload.
- [ ] `validate` sin `sub` → `UnauthorizedException`.
- Criterio: verde.

### Paso 5 — Preparar BD de test
- [ ] Añadir `TEST_DATABASE_URL` a `.env` y `.env.example`.
- [ ] Crear BD `prestamosya_test`.
- [ ] Script npm (p. ej. `pretest:e2e`) que: migra + seed con `DATABASE_URL=test`.
- [ ] Documentar en el README sección testing.
- Criterio: `pnpm test:e2e` conecta a `prestamosya_test`.

### Paso 6 — E2E de `auth`
- [ ] Booteado con `AppModule` (patrón visto en `test/app.e2e-spec.ts`), replicando `setGlobalPrefix('api')` y la validación.
- [ ] `POST /api/auth/login` con admin (seed) → 200, `{ data:{ accessToken, user } }`.
- [ ] Login inválido → 401.
- [ ] `GET /api/auth/me` con Bearer → 200; sin token → 401.
- Criterio: verde en `prestamosya_test`.

### Paso 7 — E2E de `clients`
- [ ] Helper para obtener Bearer token y CRUD real:
  - `POST /api/clients` → 200.
  - `GET /api/clients` → lista.
  - `GET /api/clients/:id` → perfil con resumen.
  - `PATCH /api/clients/:id` → update.
  - `DELETE /api/clients/:id` → no aparece en la lista (soft).
  - Cross-admin: token A no ve clientes de B (en `GET :id` → 404).
- Criterio: verde.

### Paso 8 — Cierre y cobertura
- [ ] Ejecutar `pnpm test` y `pnpm test:e2e`; revisar coverage de `AuthService`/`ClientsService` (meta ≥ 70%).
- [ ] Eliminar/evitar tests de "cables" (controller sin lógica).
- [ ] Actualizar este documento con los ajustes del plan.

---

## 10. Fuera del alcance (para más adelante)
- **Unit/Integración de `payments`** (pago completo, parcial, multi-cuota, anulación) — cuando exista el módulo.
- **Unit del cron de mora** — cuando exista el `overdue.cron.ts` (`@nestjs/schedule`).
- **Integración del `PrismaLoanRepository`** contra BD real.

---

## 11. Convivencia con el resto de la doc
- Leer también: `BUSINESS_RULES.md` (pagos/cuotas/mora/refinanciamiento), `CONVENTIONS.md` (commits `test(...)`, ramas `feat/PED-XX`), `STACK.md`.
- Commits acordes: `test(clients): cubrir resumen financiero multi-moneda`.