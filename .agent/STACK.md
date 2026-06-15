# STACK.md — prestamosya-api

Stack tecnológico, infraestructura, variables de entorno y decisiones técnicas registradas.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | NestJS |
| ORM | Prisma |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT + Refresh Tokens |
| Almacenamiento de archivos | **POR DECIDIR** — Cloudinary, ImageKit u otro servicio gratuito/freemium. No implementar hasta que se tome la decisión. |
| Tareas programadas | @nestjs/schedule |
| Validación | class-validator + class-transformer |
| Documentación | Swagger (OpenAPI) en `/api/docs` |
| Servidor | VPS Ubuntu + Nginx + PM2 + CI/CD via GitHub Actions |
| Package manager | pnpm |

---

## Variables de entorno requeridas

```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/prestamosya

# JWT
JWT_SECRET=cadena_aleatoria_muy_larga_minimo_64_caracteres
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=otra_cadena_aleatoria_diferente
JWT_REFRESH_EXPIRES_IN=30d

# App
PORT=3000
NODE_ENV=development

# Almacenamiento de archivos — POR DECIDIR, no implementar aún
# FILE_STORAGE_PROVIDER=
# FILE_STORAGE_API_KEY=
```

---

## Infraestructura de producción

- VPS Ubuntu
- PostgreSQL nativo (sin Docker en producción — VPS con recursos limitados)
- PM2 como process manager
- Nginx como reverse proxy
- CI/CD via GitHub Actions

---

## Decisiones técnicas registradas

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Clean Architecture solo en loans | Aplicar en todos los módulos | Los demás módulos son CRUD simple — agregar capas sería sobreingeniería |
| Arquitectura estándar NestJS en el resto | Clean Architecture global | Velocidad de desarrollo, menos archivos, suficiente para la complejidad real |
| Prisma sobre TypeORM | TypeORM | Schema como fuente de verdad, generación automática de tipos, migraciones más simples |
| PostgreSQL sobre MongoDB | MongoDB | Datos financieros requieren ACID y relaciones. Los datos son relacionales por naturaleza |
| JWT + Refresh Tokens | Solo JWT | Sesión persistente sin comprometer seguridad. Refresh tokens revocables en BD |
| Sin Docker en producción | Docker Compose | VPS con recursos limitados — PostgreSQL nativo + PM2 es más eficiente |
| Redis no incluido | Redis para cache | No necesario para el volumen del MVP. Se evalúa en Fase 2 si el dashboard es lento |
| Garantías al cliente | Garantías al préstamo | Un cliente puede tener múltiples bienes. Se reutilizan entre préstamos |
| Pagos nunca se eliminan | Hard delete | Auditoría financiera. Todo movimiento de dinero debe tener trazabilidad completa |
| `archived` en cuotas | Eliminar al refinanciar | Historial completo del préstamo. Las cuotas archivadas son invisibles en la UI pero existen en BD |

## Decisiones pendientes

| Decisión | Opciones en evaluación | Bloqueado hasta |
|----------|----------------------|-----------------|
| Almacenamiento de archivos | Cloudinary, ImageKit, u otro freemium | Antes de implementar guarantees/photos |
| Framework de testing | Por definir | Antes de escribir el primer test |
| Clean Architecture en payments | Aplicar parcialmente | Si la complejidad del módulo lo requiere a futuro |

---

## Tickets de Linear

El proyecto se gestiona en Linear bajo el proyecto **PrestApp — App de Préstamos**.
Cada rama de git debe corresponder a un ticket: `feature/PED-XX-descripcion-breve`

Sprint 0 activo (hasta 16 jun):
- PED-5 — Schema Prisma ← IN PROGRESS
- PED-7 — Inicializar repo NestJS
- PED-9 — Migraciones y seed
- PED-6 — Setup VPS
- PED-10 — Configurar VPS
