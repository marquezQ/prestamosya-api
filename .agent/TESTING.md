# TESTING.md — prestamosya-api

Estrategia de testing, prioridad de cobertura y patrones por tipo de módulo.

---

## Framework

**POR DECIDIR** — no asumir ningún framework específico hasta que se tome la decisión.
No escribir ningún test hasta que se resuelva esta decisión pendiente.

---

## Prioridad de cobertura

| Prioridad | Target | Tipo | Razón |
|-----------|--------|------|-------|
| 1 | `LoanCalculatorService` (domain) | Unit | Casos borde financieros — sin BD |
| 2 | `LoanEntity` | Unit | Métodos: `canBeRefinanced`, `applyPayment`, estados |
| 3 | Use-cases de loans | Unit | Mockear el repositorio, verificar orquestación |
| 4 | `PaymentsService` | Unit | Pago completo, parcial, multi-cuota, anulación |
| 5 | Cron de mora | Unit | Detección de mora, cálculo de días, estados de cliente |
| 6 | `AuthService` | Unit | Login, refresh, logout |
| 7 | Flujo completo de un préstamo | E2E | Crear → pagar → refinanciar |

---

## Patrón — módulos estándar (auth, clients, payments, etc.)

- Mockear `PrismaService` directamente
- Mockear `prisma.$transaction` en tests del módulo `payments`
- Un archivo de spec por service: `clients.service.spec.ts`

---

## Patrón — módulo loans (Clean Architecture)

La separación de capas permite distintos niveles de aislamiento:

| Capa | Tipo de test | Mocks |
|------|-------------|-------|
| `domain/` | TypeScript puro | Cero mocks, cero NestJS |
| Use-cases (`application/`) | Unit | Mockear interfaz `LoanRepository` — nunca Prisma directamente |
| `PrismaLoanRepository` | Integración | Base de datos de test real |

Un archivo por capa:
- `loan.entity.spec.ts`
- `loan-calculator.service.spec.ts`
- `create-loan.use-case.spec.ts`
- `prisma-loan.repository.integration.spec.ts`
