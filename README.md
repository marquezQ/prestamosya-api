# PrestamosYA API

Backend para la gestión de préstamos personales de **PrestamosYA** (Bolivia). Construido con NestJS, Prisma v7 y PostgreSQL.

---

## Requisitos Previos

- **Node.js**: v18 o superior (v24 recomendado)
- **PNPM**: Configurado como gestor de paquetes
- **PostgreSQL**: Instancia local corriendo y base de datos configurada

---

## Configuración del Proyecto

1. **Instalar dependencias**:
   ```bash
   pnpm install
   ```

2. **Configuración de Variables de Entorno**:
   Copia el archivo `.env.example` a `.env` y edita la conexión a base de datos y la clave JWT:
   ```bash
   cp .env.example .env
   ```
   Variables requeridas en `.env`:
   ```env
   DATABASE_URL="postgresql://usuario:password@localhost:5432/prestamosya"
   JWT_SECRET="un_valor_largo_y_aleatorio_generado_con_openssl"
   JWT_EXPIRES_IN="7d"
   ```

3. **Migraciones de la Base de Datos**:
   Ejecuta las migraciones de Prisma para inicializar el esquema en la base de datos:
   ```bash
   pnpm exec prisma migrate dev
   ```

4. **Seed de Datos Iniciales**:
   Genera el usuario administrador de desarrollo por defecto:
   ```bash
   pnpm exec prisma db seed
   ```

---

## Ejecución del Proyecto

```bash
# Modo desarrollo (watch mode)
pnpm run start:dev

# Construcción de producción
pnpm run build

# Ejecución en producción
pnpm run start:prod
```

Una vez iniciado el servidor, podrás acceder a:
- **Swagger UI**: [http://localhost:3000/api](http://localhost:3000/api)
- **JSON OpenAPI**: [http://localhost:3000/api-json](http://localhost:3000/api-json)

---

## Pruebas de Autenticación (Postman / Swagger)

### Credenciales del Seed de Desarrollo
- **Username**: `admin`
- **Password**: `admin123`

### Flujo de prueba en Swagger UI:
1. Navega a `http://localhost:3000/api`.
2. Expande el endpoint `POST /api/auth/login` y presiona **"Try it out"**.
3. Rellena el body con las credenciales por defecto de arriba y presiona **"Execute"**.
4. Copia el valor de `accessToken` de la respuesta JSON.
5. Sube al botón superior de Swagger **"Authorize"** (con el candado).
6. Pega el token y presiona **"Authorize"**.
7. Ahora puedes usar el endpoint `GET /api/auth/me` con **"Try it out"** → **"Execute"** para validar que se obtiene la sesión del usuario.

### Flujo de prueba en Postman:
1. En Postman, ve a **"Import"** y selecciona **"Link"**.
2. Pega la URL del JSON de OpenAPI: `http://localhost:3000/api-json`.
3. Esto creará una colección organizada automáticamente con los endpoints `login` y `me`.
4. Ejecuta el request `POST /api/auth/login` para recibir tu `accessToken`.
5. Edita la configuración de la colección o del request `GET /api/auth/me` para añadir una pestaña **"Authorization"** tipo **"Bearer Token"** con el token obtenido.

---

## Testing

Estrategia completa y decisiones técnicas en [`.agents/TESTING.md`](./.agents/TESTING.md).

### Unit tests (sin BD)
```bash
pnpm test
pnpm test:cov   # con cobertura
```

### Tests E2E (requieren la BD de test)
Los tests E2E arrancan la app real contra una **BD aislada** (`prestamosya_test`) para no ensuciar la de desarrollo.

1. Crea la BD de test (una sola vez):
   ```bash
   PGPASSWORD=tu_password psql -h localhost -U postgres -c "CREATE DATABASE prestamosya_test;"
   ```
2. Define en `.env` (y copia a `.env.example`):
   ```
   TEST_DATABASE_URL="postgresql://usuario:password@localhost:5432/prestamosya_test"
   ```
3. Corre los E2E. El script `pretest:e2e` aplica migraciones y seed a la BD de test automáticamente:
   ```bash
   pnpm run test:e2e
   ```

> El acceso a la BD requiere que PostgreSQL local esté corriendo y que el usuario tenga permisos para crear la BD de test.
