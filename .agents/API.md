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
GET    /api/clients/:id           → ClientProfile { client, activeLoans[], completedLoans[], guarantees[ con imageUrl ] }
PATCH  /api/clients/:id           → Client
DELETE /api/clients/:id           → 200 OK (soft delete)
```

> **Perfil de cliente (`GET /api/clients/:id`):** los préstamos se agrupan en `activeLoans` (`status: ACTIVE`) y `completedLoans` (`COMPLETED` | `DEFAULTED` | `REFINANCED`). Cada garantía incluye su campo `imageUrl: string | null`, ideal para renderizar de inmediato la foto/miniatura en las tarjetas (cards) de garantía sin hacer peticiones adicionales.

---

## Guarantees

```
POST   /api/guarantees                         → Guarantee con imageUrl (multipart/form-data)
GET    /api/guarantees?clientId=xxx            → Guarantee[] con imageUrl
GET    /api/guarantees/:id                     → Guarantee con imageUrl
PATCH  /api/guarantees/:id                     → Guarantee con imageUrl (multipart/form-data)
DELETE /api/guarantees/:id                     → 200 OK (soft delete; bloqueado si IN_USE)
```

> [!NOTE]
> **Subida de fotos a Cloudinary:**
> - Los endpoints `POST /api/guarantees` y `PATCH /api/guarantees/:id` aceptan `multipart/form-data`.
> - El campo de archivo es `image` (**opcional**).
> - El backend valida la imagen (Formatos: JPG, PNG, WebP, GIF, BMP, TIFF; Tamaño máx: **20 MB**).
> - Redimensiona con `sharp` a máximo **800x800 px** (preservando relación de aspecto) y convierte a formato **WebP**.
> - Almacena en Cloudinary en la carpeta `{user.name}/garantias/` y devuelve la URL directa en `imageUrl`.
>
> ### Cómo probar en Postman:
> 1. En Postman, seleccionar la petición `POST` o `PATCH`.
> 2. En la pestaña **Body**, seleccionar **form-data**.
> 3. Agregar los campos de texto (`clientId`, `type`, `description`, `estimatedValue`).
> 4. Agregar la clave `image`, cambiar el tipo de key de **Text** a **File**, y seleccionar un archivo de imagen.
> 5. Enviar el request. La respuesta devolverá el objeto `Guarantee` con la propiedad `imageUrl` con la URL de Cloudinary (o `null` si no tiene foto).

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

> **Bodies de create/simulate:**
> - El campo `firstDueDate` NO se envía. El body usa `startDate` (fecha de desembolso, YYYY-MM-DD) y el backend calcula la primera cuota como `startDate + 1 período`. `periodType` válido: `daily`, `weekly`, `fortnightly`, `monthly`, `custom`.
> - **Tipo de Cronograma (`scheduleType`)**: Opcional. Acepta `'EQUAL_INSTALLMENTS'` (por defecto: cuotas iguales con capital + interés) o `'INTEREST_ONLY'` (modelo Balloon: solo interés por cuota, capital completo en la última).

---

## Payments

```
GET    /api/payments/dashboard?date=2026-08-20  → { metadata: { targetDate, serverToday }, dueToday[], overdue[], paidToday[] }
POST   /api/payments                            → RegisterPaymentResult (aplica pago FIFO)
POST   /api/payments/settle                     → SettleLoanResult (liquidación anticipada con condonación de interés)
DELETE /api/payments/:id                        → 200 OK (anular pago, requiere { reason } en body)
```

> **Dashboard Dinámico de Pagos:** El parámetro `?date=YYYY-MM-DD` es opcional. Permite navegar por la agenda/carrusel de fechas de la UI. Si se omite, asume la fecha actual del servidor (`serverToday`). Devuelve metadatos con la fecha consultada (`targetDate`) y la fecha real del servidor (`serverToday`). Cada item de las listas `dueToday`, `overdue` y `paidToday` incluye la propiedad `currency` (`'BOB'` | `'USD'`) heredada del préstamo.

### Ejemplos de Body JSON para Postman:

**1. Registrar un pago (`POST /api/payments`)**

```json
{
  "loanId": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
  "amount": 500.0,
  "method": "cash",
  "paymentDate": "2026-08-19",
  "notes": "Pago entregado en mano"
}
```

> `method` acepta: `"cash"`, `"transfer"`. `paymentDate` formato: `YYYY-MM-DD`.

**2. Liquidar anticipadamente un préstamo (`POST /api/payments/settle`)**

```json
{
  "loanId": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
  "amount": 1100.00,
  "discount": 100.00,
  "method": "cash",
  "paymentDate": "2026-10-20",
  "notes": "Liquidación anticipada. Interés del mes 3 condonado."
}
```

> **Regla crítica:** `amount + discount` debe igualar exactamente el `outstandingBalance` del préstamo.
> - `amount` = dinero físico real que el cliente entrega.
> - `discount` = interés futuro que el prestamista condona (puede ser `0` si liquida sin descuento).
> - El préstamo siempre pasa a `COMPLETED`. `totalAmount` permanece intacto para estadísticas.
> - `discount` se persiste en `payment.discountAmount` — **no** se suma a la ganancia del mes.

**3. Anular un pago (`DELETE /api/payments/:id`)**

```json
{
  "reason": "Error en el monto digitado"
}
```

> **Nota Swagger / Postman:** Los DTOs tienen decoradores `@ApiProperty` con `default` configurados. Al acceder a `/api` (Swagger UI) o `/api-json` (para importar la colección a Postman), los cuerpos de solicitud se autocompletan con estos valores de ejemplo.


---

## Dashboard

```
GET    /api/dashboard/home       → HomeDashboardResponseDto { capitalEnCalle: { BOB, USD }, loansSummary, clientsSummary, overdueInstallments[], generatedAt }
```

> **Home Dashboard (`GET /api/dashboard/home`):** Retorna en una sola llamada las métricas financieras globales del Home de la app móvil:
> - `capitalEnCalle`: Capital pendiente amortizado desglosado por moneda (`BOB` y `USD`).
> - `loansSummary`: Total de préstamos activos, al día, en mora y porcentaje de morosidad (`delinquencyRate`).
> - `clientsSummary`: Conteo de clientes (total, al día, en mora y sin préstamo activo).
> - `overdueInstallments`: Cuotas vencidas priorizadas por días de atraso (`daysOverdue`), con desglose de cliente, cuota y moneda (`currency`).

---

## Stats

```
GET  /api/stats/monthly?year=2026&month=9   → MonthlyStatsResponseDto
GET  /api/stats/monthly-history?months=6   → MonthlyHistoryItemDto[]
```

> **`GET /api/stats/monthly`:** Reporte financiero completo del mes consultado. Incluye 5 secciones:
> - `period`: Metadatos del período (label, fechas, isCurrentMonth).
> - `incomeBreakdown`: Interés cobrado, capital recuperado, efectivo total recibido y condonaciones (`discountsGiven`). Desglosado en `BOB` y `USD`. **La ganancia real es `interestCollected`, no `totalCashIn`** (el capital recuperado no es ganancia, es devolución de inversión).
> - `performanceSummary`: Cuotas vencidas en el mes vs pagadas a tiempo / tarde / en mora / parciales. `collectionRate` (%), `expectedRevenue` vs `actualRevenue` y `revenueEfficiency` (%).
> - `riskIndicators`: Tasa de morosidad actual, capital en riesgo, nuevos préstamos y clientes del mes, y préstamos saldados (`completedLoansCount`).
> - `monthlyBalance`: Ganancia neta (`netProfit = interestCollected - discountsGiven`), capital desplegado en calle y retorno sobre capital (`returnOnCapital`). Todo desglosado en BOB y USD sin mezcla de monedas.
>
> Si `year` y `month` se omiten, devuelve el mes en curso según `America/La_Paz`.

> **`GET /api/stats/monthly-history`:** Historial resumido de los últimos N meses para renderizar gráficas de barras o líneas en el frontend. **El arreglo se entrega en orden cronológico** (índice 0 = mes más antiguo, último índice = mes actual), listo para plotear de izquierda a derecha en el eje X. Cada ítem incluye: `interestCollected`, `netProfit`, `collectionRate` y `newLoansCount`. Opcional: `?months=6` (por defecto 6, máximo 24).


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

### Ejemplo de respuesta (`POST /api/admin/recalculate-overdue`):

> No requiere body en el request.

```json
{
  "data": {
    "processedAt": "2026-08-20T18:45:00.000Z",
    "todayReference": "2026-08-20",
    "updatedInstallmentsCount": 5,
    "markedDelinquentClientsCount": 2,
    "restoredCurrentClientsCount": 1
  },
  "message": "Overdue recalculation completed successfully"
}
```

> **Nota Swagger / Postman:** Al acceder a Swagger UI (`/api`) o importar la colección en Postman (`/api-json`), el endpoint aparece listado bajo la categoría **admin**.

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
