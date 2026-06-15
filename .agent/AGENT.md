# AGENT.md — prestamosya-api

Archivo pivote de contexto. Léelo siempre primero. Para detalles, navega al archivo correspondiente según la sección que necesites.

---

## ¿Qué es este proyecto?

Backend de **PrestamosYA**, una app móvil para administrar préstamos personales en Bolivia.
El administrador del negocio presta dinero a clientes, genera cronogramas de cuotas y registra cobros diarios desde el celular.

Este repositorio es exclusivamente el backend. El frontend vive en `prestamosya-mobile` (React Native + Expo).

---

## Mapa de contexto — dónde buscar información detallada

| Si necesitas saber sobre... | Lee este archivo |
|-----------------------------|-----------------|
| Stack, infraestructura, decisiones técnicas y tickets | [`STACK.md`](./STACK.md) |
| Estructura de carpetas, Clean Architecture en loans, patrón estándar NestJS | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Esquema Prisma completo, modelos, enums, relaciones, índices | [`DATABASE.md`](./DATABASE.md) |
| Reglas de pagos, cuotas, mora, refinanciamiento, garantías, cálculo de cuotas | [`BUSINESS_RULES.md`](./BUSINESS_RULES.md) |
| Endpoints REST, formato de respuestas | [`API.md`](./API.md) |
| Nomenclatura, DTOs, seguridad, transacciones, commits, ramas | [`CONVENTIONS.md`](./CONVENTIONS.md) |
| Estrategia de testing, prioridades, patrones por módulo | [`TESTING.md`](./TESTING.md) |

---

## Reglas críticas — aplican siempre

1. **Clean Architecture solo en `loans`** — todos los demás módulos usan arquitectura estándar NestJS (controller → service → Prisma). No aplicar Clean Architecture en ningún otro módulo sin decisión explícita.

2. **`domain/` de loans es TypeScript puro** — nunca importar `@prisma/client`, `@nestjs/*`, ni hacer llamadas HTTP desde `domain/`.

3. **Los pagos nunca se eliminan** — solo se anulan con `voided=true` y `void_reason` obligatorio.

4. **Las cuotas nunca se eliminan** — al refinanciar se marcan `archived=true`. Siempre filtrar `archived=false` en queries del cronograma activo.

5. **Usar `prisma.$transaction`** siempre que una operación modifique más de una tabla.

6. **No implementar almacenamiento de archivos** hasta que se tome la decisión de proveedor (Cloudinary, ImageKit u otro). Ver `STACK.md`.

7. **No implementar tests** hasta que se decida el framework. Ver `TESTING.md`.

8. **Nunca devolver `passwordHash`** en ninguna respuesta de la API.

9. **Nunca mezclar monedas** (BOB/USD) en un mismo cálculo financiero.

10. **La última cuota absorbe la diferencia de redondeo** — la suma exacta de cuotas debe ser igual a `loan.totalAmount`.

---

## Flujos clave (resumen ejecutivo)

### Crear un préstamo
`POST /api/loans` → llama `CreateLoanUseCase` → `LoanCalculatorService.calculateInstallments()` → persiste en BD vía `PrismaLoanRepository` en una sola transacción.

### Registrar un pago
`POST /api/payments` → crea `Payment` + uno o más `PaymentInstallment` + actualiza `Installment.paidAmount` + actualiza `Loan.outstandingBalance` → todo en `$transaction`.

### Anular un pago
`DELETE /api/payments/:id` → `voided=true`, `void_reason` obligatorio → revertir `paidAmount` en cuotas afectadas → recalcular estados → `$transaction`.

### Refinanciar
`POST /api/loans/:id/refinance` → snapshot en `loan_refinances` → cuotas activas a `archived=true` → nuevas cuotas desde el saldo pendiente → `$transaction`.

### Cron de mora
Corre a las 6:00 AM → detecta cuotas vencidas según `graceDays` → actualiza `daysOverdue` → sincroniza `ClientStatus`.