# LOANS_MODULE.md — prestamosya-api

El módulo `loans` es el **corazón financiero** de la aplicación. Por la complejidad de sus cálculos (cronogramas, redondeo, tasas, mora, refinanciamiento), es el único módulo del backend construido usando **Clean Architecture**.

Este documento sirve como registro de todo lo implementado en los Commits Base (Fases 0 a 5) y como mapa de ruta para las fases faltantes.

---

## Arquitectura del Módulo

El flujo de dependencias respeta estrictamente la regla de Clean Architecture (las flechas apuntan hacia adentro):
`Infrastructure` → `Application` → `Domain`

1. **Domain**: TypeScript puro. Prohibido importar NestJS o Prisma.
2. **Application**: Orquesta el dominio. Usa inyección de dependencias mediante *interfaces* (puertos).
3. **Infrastructure**: Conoce de Prisma y del protocolo HTTP (Controllers). Implementa los puertos.

---

## Lo que se ha implementado (Fases 0 a 5)

La primera etapa de construcción estableció los cimientos y el flujo completo de creación de préstamos.

### Fase 0: Value Objects y Enums (Dominio)
- **`Money.vo.ts`**: Value Object inmutable envolviendo `decimal.js`. Todas las operaciones financieras del dominio usan `Money` en lugar de `number`. Garantiza protección contra problemas de coma flotante de JS y prohíbe mezclar monedas (ej. sumar BOB con USD).
- **Enums**: `PeriodType`, `LoanMode`, `LoanStatus`, `InstallmentStatus`.

### Fase 1: Entidades (Dominio)
- **`LoanEntity`**: Representa el préstamo. Contiene métodos puros del negocio como `canBeRefinanced()` y `isActive()`.
- **`InstallmentEntity`**: Representa una cuota. 

### Fase 2: Servicios de Dominio
- **`LoanCalculatorService`**: Servicio sin dependencias que genera cronogramas de pago.
- **Regla Crítica resuelta**: Si al dividir el capital entre las cuotas se generan fracciones infinitas (ej. $1000 / 3 = 333.33), el servicio **acumula los decimales perdidos y los suma a la última cuota** (ej. 333.34) garantizando que el total cobrado coincida exactamente con el capital.

### Fase 3: Puertos (Dominio y Aplicación)
- **Repositorios**: Creación de las interfaces `LoanRepository` y `InstallmentRepository`.
- **`UnitOfWork`**: Definición del puerto para manejar transacciones ACID en la capa de aplicación sin acoplarla a Prisma.

### Fase 4: Casos de Uso
- **`SimulateLoanUseCase`**: Caso de uso que permite al frontend previsualizar el cronograma generado (sin guardar en base de datos) usando `LoanCalculatorService`. Responde a `POST /api/loans/simulate`.
- **`CreateLoanUseCase`**: Caso de uso orquestador. 
  1. Verifica que el cliente existe.
  2. Valida préstamos MANUALES vs AUTOMÁTICOS.
  3. Ejecuta el `LoanCalculatorService`.
  4. Envuelve todo en una transacción atómica mediante `UnitOfWork`.

> [!IMPORTANT]
> **Integración con React Native:** El frontend debe implementar un flujo de 3 pasos:
> 1) Llama a `/simulate` y guarda el resultado en Zustand. 
> 2) El admin revisa la tabla. 
> 3) Si acepta sin cambios, llama a `POST /api/loans` con `mode: AUTOMATIC`. Si hace ajustes manuales, llama a `POST /api/loans` con `mode: MANUAL` enviando el arreglo de cuotas modificado. **Enviar el modo correcto es obligatorio para no romper la lógica de negocio.**

### Fase 5: Infraestructura (Prisma, Controladores y Fixes)
- **Persistencia**: Implementación de `PrismaLoanRepository`, `PrismaInstallmentRepository` y `PrismaUnitOfWork`.
- **API**: `LoansController` implementado con decoradores Swagger (`.docs.ts`).
- **Bugs resueltos (Importante para agentes futuros):**
  1. **Bug DI NestJS**: El repositorio recibía `PrismaClientLike` en su constructor, lo cual compila a `Object` en metadatos y crashea el DI de Nest. **Solución:** Se usó `useFactory` y `inject: [PrismaService]` en `LoansModule`.
  2. **Bug Auth Postman**: El decorador `@ApiBearerAuth()` en el controlador rompía la herencia de auth en la carpeta de Postman. **Solución:** Remover el decorador y confiar en la configuración de seguridad global (`document.security` en `main.ts`).
  3. **Bug CurrentUser JWT**: El payload de JWT guarda el ID en `.sub`, no en `.id`. **Solución:** Uso correcto de `@CurrentUser() user: JwtPayload` -> `user.sub`.

### Fase 6: Módulo Guarantees y Vinculación
- **CRUD de Garantías por Cliente**: Módulo `GuaranteesModule` (`POST/GET/PATCH/DELETE /api/guarantees`). Permite registrar garantías pertenecientes a un cliente. Soft delete habilitado; prohíbe eliminar si está `IN_USE`.
- **`LinkGuaranteeUseCase`**: Vincula una garantía `AVAILABLE` a un préstamo (`POST /api/loans/:id/guarantees`). Marca la garantía como `IN_USE` y la vinculación como `ACTIVE`. Impide doble vinculación.
- **`UnlinkGuaranteeUseCase`**: Desvincula la garantía (`DELETE /api/loans/:id/guarantees/:guaranteeId`), devuelve la garantía a `AVAILABLE` y marca el link como `RELEASED`.

### Fase 7: Detalle del Préstamo y Consultas (`GetLoanDetailUseCase`)
- **`GET /api/loans/:id`**: Retorna la estructura completa del préstamo (`loan`, `installments`, `guarantees`, `payments`).
- **`GET /api/loans/:id/installments`**: Retorna únicamente el cronograma de cuotas activas.

### Testing de esta etapa
- Se implementaron **94 tests unitarios aislados** (`11 test suites` en verde) verificando exhaustivamente: las lógicas de redondeo, sumas de `Money`, vinculación de garantías con chequeo de estado `IN_USE`, y generación de respuestas de detalle.

---

## Fases Pendientes (Roadmap Futuro)

Las siguientes fases deben desarrollarse para dar por concluido completamente el módulo financiero.

### Fase 8: Flujos de Pago (Payment integration)
- Aunque los pagos vivirán en su propio módulo (`payments`), el dominio de `loans` necesita la lógica para reaccionar a un pago.
- **Requerido**: Añadir métodos en `LoanEntity` e `InstallmentEntity` para aplicar pagos parciales o totales y cambiar estados dinámicamente (`PENDING` -> `PARTIAL` -> `PAID`).

### Fase 9: Refinanciamiento (Simulación y Ejecución)
- **Caso de uso (`CalculateRefinanceUseCase`)**: Tomar el saldo deudor actual (`outstandingBalance`), sumar capital adicional solicitado, calcular nuevo interés y simular las nuevas cuotas sin tocar la base de datos.
- **Caso de uso (`ExecuteRefinanceUseCase`)**: Guardar snapshot en `loan_refinances`, archivar cuotas anteriores y crear el nuevo cronograma atómicamente.

### Fase 10: Integración Perfil de Cliente, Cron Job de Mora y E2E
- **Integración con Clientes**: Finalizar el cálculo del *Resumen Financiero* en `GET /api/clients/:id` (tasa de cumplimiento, días de atraso acumulados, saldo por moneda).
- **Cron Job de Mora**: `@nestjs/schedule` diario a las 6:00 AM.
- **E2E Testing**: Suite de tests End-to-End con base de datos de pruebas real.
