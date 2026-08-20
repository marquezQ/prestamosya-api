# BUSINESS_RULES.md — prestamosya-api

Reglas de negocio que el agente debe respetar en todo momento.
**Este archivo es la fuente de verdad para la lógica financiera y de dominio.**

---

## Pagos

- Un pago puede cubrir **una o varias cuotas** en una sola operación
- Siempre se crea un registro en `payments` Y uno o más en `payment_installments`
- `payment_installments.amount_applied` registra cuánto de ese pago fue a esa cuota específica
- Los pagos **nunca se eliminan** — solo se anulan con `voided=true` y `void_reason` obligatorio
- Al anular un pago: revertir `installment.paidAmount`, recalcular estado de la cuota y `loan.outstandingBalance`
- **Usar `$transaction`** siempre que un pago modifique múltiples tablas

---

## Cuotas (Installments)

- `paidAmount` se **acumula** — nunca se reemplaza, siempre se suma
- Estado calculado dinámicamente según `paidAmount` vs `totalAmount`:

| Condición | Estado |
|-----------|--------|
| `paidAmount == 0` y no vencida | `PENDING` |
| `paidAmount == 0` y vencida | `OVERDUE` |
| `0 < paidAmount < totalAmount` | `PARTIAL` |
| `paidAmount >= totalAmount` | `PAID` |

- `archived=true` al refinanciar — **nunca se eliminan**, solo se ocultan
- Siempre filtrar `archived=false` en las queries del cronograma activo

---

## Mora y Cron Job

> [!NOTE]
> **El cron de mora está 100% IMPLEMENTADO.** Se ejecuta automáticamente todos los días a las 6:00 AM (`America/La_Paz`) e incluye el endpoint de disparo manual de fallback `POST /api/admin/recalculate-overdue`.
> - `daysOverdue` se calcula automáticamente según la fecha actual menos `dueDate`.
> - Las cuotas activas vencidas pasan a `OVERDUE` respetando los `graceDays` de la configuración del negocio del administrador.
> - Los clientes cambian automáticamente entre `CURRENT` y `DELINQUENT`.

El cron corre a las **6:00 AM diario** con la expresión `@Cron('0 6 * * *')`.

```typescript
@Cron('0 6 * * *')
async checkOverdueInstallments() {
  // 1. Obtener grace_days de la configuración del admin
  // 2. Marcar cuotas vencidas: dueDate < (today - graceDays) AND status != PAID
  // 3. Calcular daysOverdue para cada cuota
  // 4. Marcar clientes MOROSO si tienen cuotas OVERDUE
  // 5. Quitar MOROSO a clientes que ya pagaron todas sus cuotas vencidas
  // 6. Loguear cuántas cuotas y clientes se actualizaron
}
```

**Reglas:**
- Una cuota pasa a `OVERDUE` cuando: `dueDate < hoy - graceDays` Y estado != `PAID`
- `daysOverdue` = diferencia en días entre hoy y `dueDate`
- Un cliente pasa a `MOROSO` si tiene **al menos 1 cuota `OVERDUE`**
- Un cliente vuelve a `AL_DIA` automáticamente cuando no tiene cuotas `OVERDUE`

---

## Refinanciamiento

- El préstamo **mantiene su ID original** — no se crea uno nuevo
- Antes de ejecutar: guardar snapshot en `loan_refinances`
- Las cuotas restantes se marcan `archived=true` — no se eliminan
- Se generan cuotas nuevas a partir del saldo pendiente actual
- `amountDelivered` en `loan_refinances` = dinero físico real entregado ese día (puede ser 0)
- Al refinanciar con monto adicional: `newCapital = outstandingBalance + additionalAmount`

### Flujo del refinanciamiento
1. Verificar que el préstamo es refinanciable (`canBeRefinanced()`)
2. Guardar snapshot en `loan_refinances` con los valores actuales
3. Marcar cuotas pendientes como `archived=true`
4. Calcular nuevo capital (`outstandingBalance + additionalAmount`)
5. Generar nuevas cuotas con la nueva configuración
6. Actualizar el préstamo (`status=ACTIVE`, nuevos totales)

---

## Garantías

- Una garantía en estado `IN_USE` **no puede** vincularse a otro préstamo
- Al vincular garantía a préstamo: `guarantee.status → IN_USE`
- Al saldar el préstamo: todas sus garantías pasan a `status → RELEASED` automáticamente
- Las garantías pertenecen al **cliente**, no al préstamo. La vinculación va en `loan_guarantees`

---

## Moneda

- Cada préstamo tiene su propia moneda (`BOB` o `USD`)
- La tasa de cambio en `business_config` es **solo referencial** — no convierte automáticamente
- **Nunca mezclar monedas en un mismo cálculo**

---

## LoanCalculatorService — Lógica financiera del dominio

Es el componente más crítico. Vive en `loans/domain/services/` — TypeScript puro, sin dependencias externas ni NestJS.

### Fecha de primera cuota (firstDueDate) — SIEMPRE la calcula el backend

> [!IMPORTANT]
> El campo `firstDueDate` **no existe en ningún DTO de entrada** (ni `POST /api/loans` ni `POST /api/loans/simulate`). El frontend **solo envía `startDate`** (fecha de desembolso) y el backend calcula la primera cuota como `startDate + 1 período`:
>
> | Período | Avance de 1 cuota |
> |---------|-------------------|
> | `daily` | +1 día |
> | `weekly` | +7 días |
> | `fortnightly` | +15 días |
> | `monthly` | +1 mes |
> | `custom` | no aplica (solo modo manual) |
>
> - En modo **AUTOMATIC**: `LoanCalculatorService.calculateDueDate(startDate, periodType, 1)`.
> - En modo **MANUAL**: `firstDueDate = installments[0].dueDate` del cronograma enviado.
>
> `firstDueDate` sigue existiendo en la entidad `Loan`, en la BD (columna `first_due_date`) y en las **respuestas** de la API — solo se quitó de los **inputs**.

### Modo automático — interés fijo sobre capital

```
cuota = (capital × tasa) + (capital / n_cuotas)

Ejemplo: Bs 1.000 al 10% mensual × 3 cuotas
  interés por cuota = 1.000 × 0.10 = 100
  capital por cuota = 1.000 / 3 = 333.33
  cuota total       = 433.33
  última cuota ajustada para absorber diferencia de redondeo
```

### Tipos de período soportados

El enum `PeriodType` incluye: `daily`, `weekly`, **`fortnightly`** (quincenal, +15 días), `monthly`, `custom`. El valor `fortnightly` se agregó con la migración `20260818012602_add_fortnightly_period`.

### Modo manual

- El admin define fecha y monto de cada cuota libremente
- Validar que `SUM(installment.totalAmount) >= loan.capitalAmount`
- No calcular nada — solo persistir lo que el admin definió

### Flujo de Integración Frontend ↔ Backend (React Native)

Para la creación de préstamos (formulario de 3 pasos) el frontend DEBE respetar este flujo usando un manejador de estado (ej. Zustand):

1. **Paso de Simulación**: El frontend envía los parámetros a `POST /api/loans/simulate`. El backend retorna el cronograma proyectado (sin persistir nada).
2. **Paso de Revisión (Zustand)**: El frontend almacena esta simulación en memoria y la muestra al admin.
3. **Paso de Creación**:
   - **Camino Automático:** Si el admin acepta la tabla generada sin hacer ningún cambio, el frontend hace `POST /api/loans` mandando `mode: "AUTOMATIC"` junto a los parámetros básicos originales. **NO debe** enviar la lista de cuotas. El backend recalculará todo de forma idéntica.
   - **Camino Manual:** Si el admin ajustó alguna fecha o monto en la tabla, el frontend hace `POST /api/loans` mandando `mode: "MANUAL"` **junto al arreglo completo modificado** dentro de la propiedad `manualInstallments`.
   
> [!IMPORTANT]
> El frontend está estrictamente obligado a mandar el `mode` (`AUTOMATIC` o `MANUAL`). Si se manda `MANUAL` sin el arreglo de cuotas, el sistema arrojará un Bad Request. Si se manda `AUTOMATIC`, el sistema ignorará por completo cualquier arreglo que se envíe e impondrá el cálculo oficial del sistema.

### Reglas de redondeo

- Todos los montos: `Decimal` con **2 decimales**
- La diferencia de centavos por redondeo va en la **última cuota**
- La suma de todas las cuotas debe ser **exactamente igual** a `loan.totalAmount`
