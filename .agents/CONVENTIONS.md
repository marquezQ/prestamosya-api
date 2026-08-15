# CONVENTIONS.md — prestamosya-api

Convenciones de código, nomenclatura, DTOs, respuestas de la API, transacciones y Git.
El agente debe seguir estas convenciones en **todo código que genere**.

---

## Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Archivos y carpetas | kebab-case | `loan-calculator.service.ts` |
| Clases | PascalCase | `LoanCalculatorService` |
| Variables y métodos | camelCase | `calculateInstallments` |
| Enums en BD | UPPER_SNAKE_CASE | `ACTIVE`, `IN_USE` |
| Columnas en BD | snake_case | gestionado con `@map` en Prisma |
| Endpoints REST | kebab-case plural | `/api/clients`, `/api/loan-refinances` |

---

## DTOs

Un archivo por DTO. Usar decoradores de `class-validator` siempre.

**Reglas Críticas de Validación:**
- Usar `@IsInt()` en lugar de `@IsNumber()` para campos enteros (ej. número de cuotas).
- Usar `@IsIn(['A', 'B'])` además de `@IsString()` para valores literales restringidos (ej. monedas).
- Siempre delimitar números con `@Min()` y `@Max()` para evitar edge-cases matemáticos.
- Usar `@IsNotEmpty()` en strings obligatorios, ya que `@IsString()` acepta strings vacíos `""`.

```typescript
export class CreateClientDto {
  @ApiProperty({ default: 'María Quispe Mamani', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ default: '71234567', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @ApiProperty({ default: '5555555 LP', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ default: 'Av. Arce 123, La Paz' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ default: 'Prefiere cobro por las mañanas.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

Los decoradores `@ApiProperty` / `@ApiPropertyOptional` usan `default` (no `example`) para que Postman pre-cargue los valores al importar el OpenAPI JSON.

---

## Respuestas de la API

```typescript
// Éxito — envelope estándar
{ data: T, message?: string }

// Error — manejado automáticamente por HttpExceptionFilter global
{ statusCode: number, message: string, error: string }
```

El `HttpExceptionFilter` está registrado globalmente en `main.ts`. No manejar errores HTTP manualmente en los controllers.

---

## Seguridad

- Todas las rutas protegidas con `JwtAuthGuard` excepto `/api/auth/login` y `/health`
- Decorator `@CurrentUser() user: JwtPayload` para acceder al usuario. El ID del usuario está en **`user.sub`** (NO usar `@CurrentUser('id')` ya que el payload no tiene esa propiedad).
- Validar que el recurso pertenece al usuario antes de operar — un admin no puede ver datos de otro admin
- Rate limiting en `POST /api/auth/login`: máximo 5 intentos fallidos por IP en 15 minutos
- Helmet configurado en `main.ts`
- Contraseñas hasheadas con **bcrypt (rounds: 12)**
- Los tokens de refresco se almacenan **hasheados** en BD — nunca en texto plano
- **Nunca devolver `passwordHash`** en ninguna respuesta

---

## Transacciones

Usar `prisma.$transaction` **obligatoriamente** cuando una operación toca más de una tabla.

```typescript
await this.prisma.$transaction([
  this.prisma.payment.create({ data: paymentData }),
  this.prisma.paymentInstallment.createMany({ data: links }),
  this.prisma.installment.update({ where: { id }, data: { paidAmount, status } }),
  this.prisma.loan.update({ where: { id }, data: { outstandingBalance, totalPaid } }),
]);
```

Aplica especialmente en: registro de pagos, anulación de pagos, refinanciamiento, actualización de estados de mora.

---

## Convenciones de Git

### Ramas

```
feature/PED-XX-descripcion-breve
fix/PED-XX-descripcion-breve
chore/PED-XX-descripcion-breve
```

### Commits (Conventional Commits)

Formato: `tipo(scope): descripción en minúsculas`

```
feat(loans): agregar caso de uso de refinanciamiento
feat(loans/domain): agregar método canBeRefinanced en LoanEntity
fix(payments): corregir reversión de saldo al anular pago
test(loans/calculator): agregar casos borde de redondeo en última cuota
chore(prisma): regenerar cliente después de migración
refactor(auth): extraer lógica de hash a método privado
```

Tipos permitidos: `feat`, `fix`, `test`, `chore`, `refactor`, `docs`, `perf`

---

## Documentación API (Swagger / Postman)

- **Postman y Herencia de Auth**: Dado que la seguridad (Bearer Token) está configurada globalmente en `main.ts` (`document.security`), **NUNCA** debes agregar el decorador `@ApiBearerAuth('access-token')` a nivel de controller ni método. 
- Si agregas `@ApiBearerAuth`, Swagger coloca el esquema de seguridad directamente sobre ese endpoint. Cuando se exporta el JSON a Postman, Postman asigna la seguridad manual a esa petición, **rompiendo la herencia de la carpeta padre**. Al omitirlo, todas las rutas heredan limpiamente el token de la colección padre.
