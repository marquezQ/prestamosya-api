# API.md — prestamosya-api

Inventario completo de endpoints REST del backend.
Prefijo global: `/api`. Documentación interactiva disponible en `/api` (Swagger UI) y especificación JSON disponible en `/api-json` (Postman).

Todas las rutas requieren `Authorization: Bearer <access_token>` excepto las marcadas como públicas.

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
GET    /api/clients               → Client[]
POST   /api/clients               → Client
GET    /api/clients/:id           → ClientProfile (con préstamos activos, garantías, resumen financiero)
PATCH  /api/clients/:id           → Client
DELETE /api/clients/:id           → 200 OK (soft delete)
```

---

## Guarantees

```
POST   /api/clients/:id/guarantees            → Guarantee
GET    /api/clients/:id/guarantees            → Guarantee[]
PATCH  /api/guarantees/:id                    → Guarantee
DELETE /api/guarantees/:id                    → 200 OK (soft delete)
POST   /api/guarantees/:id/photos             → GuaranteePhoto
DELETE /api/guarantees/:id/photos/:photoId    → 200 OK
```

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
