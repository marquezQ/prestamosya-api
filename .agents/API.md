# API.md — prestamosya-api

Inventario completo de endpoints REST del backend.
Prefijo global: `/api`. Documentación interactiva disponible en `/api` (Swagger UI) y especificación JSON disponible en `/api-json` (Postman).

Todas las rutas requieren `Authorization: Bearer <access_token>` excepto las marcadas como públicas.

> [!WARNING]
> **Importación en Postman:** La API define su seguridad de forma global (`document.security` en `main.ts`). **NO usar `@ApiBearerAuth()` en los controladores**, ya que esto obliga a Swagger a colocar el esquema de seguridad a nivel de ruta individual, lo cual rompe la herencia de tokens a nivel de carpeta cuando se importa en Postman.

---

## Auth (público / protegido)

```
POST   /api/auth/login           → { accessToken, user }              [público]
GET    /api/auth/me              → User payload                       [protegido]
POST   /api/auth/logout          → { message }                        [protegido]
```

> Nota: Refresh tokens (`/api/auth/refresh`) están planeados para versiones futuras y están fuera del alcance actual.

---

## Clients

```
GET    /api/clients               → Client[] (cada item incluye activeLoanCount; status = ClientStatus del DB)
POST   /api/clients               → Client
GET    /api/clients/:id           → ClientProfile { client, activeLoans[], completedLoans[], guarantees[] }
PATCH  /api/clients/:id           → Client
DELETE /api/clients/:id           → 200 OK (soft delete)
```

> **Perfil de cliente (`GET /api/clients/:id`):** los préstamos se agrupan en `activeLoans` (`status: ACTIVE`) y `completedLoans` (`COMPLETED` | `DEFAULTED` | `REFINANCED`). Cada préstamo es un **resumen** (sin cuotas ni pagos). Para ver el cronograma completo se llama a `GET /api/loans/:id`. No existe resumen financiero ni `nextInstallment` en este endpoint.

---

## Guarantees

```
POST   /api/guarantees                         → Guarantee (clientId va en el body)
GET    /api/guarantees?clientId=xxx            → Guarantee[]
GET    /api/guarantees/:id                     → Guarantee
PATCH  /api/guarantees/:id                     → Guarantee (clientId no editable)
DELETE /api/guarantees/:id                     → 200 OK (soft delete; bloqueado si IN_USE)
```

> [!NOTE]
> **Fotos de garantías NO implementadas.** La tabla `guarantee_photos` existe en BD pero no hay endpoints. Bloqueado hasta decidir proveedor de almacenamiento de archivos (Cloudinary/ImageKit — ver `STACK.md`).

---

## Loans

```
POST   /api/loans                             → Loan + Installment[] generadas
GET    /api/loans/:id                         → LoanDetail (con cuotas y pagos)
GET    /api/loans/:id/installments            → Installment[]
PATCH  /api/loans/:id                         → Loan
POST   /api/loans/:id/guarantees              → LoanGuarantee (vincular garantía)
DELETE /api/loans/:id/guarantees/:guaranteeId → 200 OK (desvincular)
POST   /api/loans/:id/refinance               → LoanRefinance + nuevas Installment[]
```

> **Bodies de create/simulate:** el campo `firstDueDate` NO se envía. El body usa `startDate` (fecha de desembolso, YYYY-MM-DD) y el backend calcula la primera cuota como `startDate + 1 período`. `periodType` válido: `daily`, `weekly`, `fortnightly`, `monthly`, `custom`.

---

## Payments

```
POST   /api/payments             → Payment + PaymentInstallment[]
GET    /api/loans/:id/payments   → Payment[]
DELETE /api/payments/:id         → 200 OK (anular, requiere void_reason en body)
```

---

## Dashboard

```
GET    /api/dashboard/today      → DashboardToday
```

---

## Stats

```
GET    /api/stats?period=week|month|year → BusinessStats
```

---

## Config

```
GET    /api/config               → BusinessConfig
PATCH  /api/config               → BusinessConfig
```

---

## Admin

```
POST   /api/admin/recalculate-overdue → forzar recálculo manual del cron de mora
```

---

## Health (público)

```
GET    /health                   → { status: 'ok', timestamp, database: 'connected' }
```

---

## Formato de respuestas

```typescript
// Éxito
{ data: T, message?: string }

// Error (manejado globalmente por HttpExceptionFilter)
{ statusCode: number, message: string, error: string }
```
