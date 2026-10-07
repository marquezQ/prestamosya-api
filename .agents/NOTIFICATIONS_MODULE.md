# NOTIFICATIONS_MODULE.md — prestamosya-api

Documentación técnica integral del **Módulo de Notificaciones** de PrestamosYA API.

---

## 📌 Visión General

El módulo de notificaciones proporciona una arquitectura desacoplada y multicanal para la entrega de alertas e información del sistema a los usuarios del backend.

Actualmente implementa:
1. **Canal In-App (Persistente / Fiable):** Notificaciones en la base de datos visualizables en la bandeja/campanita del cliente (React Native Expo o Web Next.js).
2. **Canal Push Expo (Best-effort / Opcional):** Notificaciones push enviadas a dispositivos móviles a través de **Expo Push Notifications Service** (vibración, sonido y banners flotantes).
3. **Resumen Diario Programado (Cron Job):** Notificación automática desapachada todos los días a las **8:00 AM (Hora Bolivia - `America/La_Paz`)** a todos los administradores activos con el total de cobros programados para el día y la cantidad de clientes en mora.
4. **Disparo Manual de Prueba (Trigger Endpoint):** Endpoint exclusivo para administradores que permite probar el envío del resumen diario en tiempo real sin esperar al horario del cron.

---

## 🏗️ Arquitectura y Principios SOLID

El módulo sigue una arquitectura **Ports & Adapters (Hexagonal)** aplicando principios SOLID:

```
[Cron Job 8:00 AM] / [POST /trigger-daily-summary]
                   │
                   ▼
       [NotificationsService]
         │              │
         ▼              ▼
  [InAppNotificationProvider]   [ExpoPushProvider]
  (Guarda en PostgreSQL)       (Despacha a Expo SDK)
```

- **Single Responsibility (SRP):**
  - `NotificationsController`: Enrutamiento y delegación HTTP.
  - `NotificationsDocs`: Contrato OpenAPI / Swagger aislado del controlador.
  - `NotificationsCronService`: Programación del cron job diario a las 8:00 AM.
  - `NotificationsService`: Lógica de negocio (conteo de cobros, morosos y orquestación de canales).
  - `InAppNotificationProvider`: Persistencia en la tabla `notifications`.
  - `ExpoPushProvider`: Comunicación con los servidores de Expo vía `@expo/server-sdk`.
- **Open/Closed (OCP) e Inversión de Dependencias (DIP):**
  - Definición del puerto de comunicación `PushSender` e `InAppSender`. Se pueden agregar proveedores nuevos (ej. OneSignal, FCM directo, Twilio WhatsApp) implementando la interfaz sin modificar el servicio principal.
- **Idempotencia:**
  - El registro de tokens de dispositivos (`POST /device-tokens`) utiliza `upsert` basado en la clave única `(userId, platform, token)`. Si la app envía el token en cada inicio, no se duplican registros en la BD.

---

## 🗄️ Modelo de Datos (Prisma)

### Enums

```prisma
enum NotificationType {
  DAILY_SUMMARY
  PAYMENT_OVERDUE
  LOAN_COMPLETED
  SYSTEM_ALERT
}
```

### Modelos

```prisma
model Notification {
  id        String           @id @default(uuid())
  userId    String           @map("user_id")
  type      NotificationType
  title     String           @db.VarChar(150)
  body      String           @db.Text
  payload   Json?
  readAt    DateTime?        @map("read_at") @db.Timestamptz(3)
  createdAt DateTime         @default(now()) @db.Timestamptz(3) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@index([userId, createdAt])
  @@map("notifications")
}

model DeviceToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  platform  String   @db.VarChar(20) // 'expo', 'ios', 'android', 'web'
  token     String   @db.VarChar(255)
  createdAt DateTime @default(now()) @db.Timestamptz(3) @map("created_at")
  updatedAt DateTime @updatedAt @db.Timestamptz(3) @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, platform, token])
  @@map("device_tokens")
}
```

---

## 🔌 Inventario de Endpoints REST (`/api/notifications`)

Todas las rutas requieren cabecera `Authorization: Bearer <JWT_TOKEN>`.

| Método | Ruta | Rol Mínimo | Descripción |
|---|---|---|---|
| `GET` | `/api/notifications` | Autenticado | Obtiene la lista paginada de notificaciones del usuario (`page`, `limit`, `onlyUnread`). |
| `GET` | `/api/notifications/unread-count` | Autenticado | Retorna `{ unreadCount: number }` para mostrar el badge en la campanita. |
| `PATCH` | `/api/notifications/:id/read` | Autenticado | Marca una notificación específica como leída. |
| `PATCH` | `/api/notifications/read-all` | Autenticado | Marca todas las notificaciones pendientes del usuario como leídas. |
| `POST` | `/api/notifications/device-tokens` | Autenticado | Registra/sincroniza el push token del dispositivo móvil. |
| `DELETE` | `/api/notifications/device-tokens` | Autenticado | Elimina un push token al cerrar sesión (Logout). |
| `POST` | `/api/notifications/trigger-daily-summary` | Admin | **Prueba manual:** Ejecuta el proceso del resumen diario inmediatamente. |

---

## ⏰ Cron Job — Resumen Diario

- **Expresión Cron:** `0 8 * * *`
- **Zona Horaria:** `America/La_Paz` (UTC-4).
- **Procesamiento:**
  1. Identifica a todos los usuarios activos con `role = admin`.
  2. Consulta el estado del Dashboard del día actual (`dueTodayCount` y `overdueClients`).
  3. Crea una entrada en la tabla `notifications` (canal in-app).
  4. Busca los `device_tokens` registrados para cada admin y envía la notificación push a Expo.

---

## 📱 Guía de Integración para Agente / Cliente Mobile (Expo React Native)

1. **Configuración en `app.json`:**
   Es obligatorio contar con el `projectId` de EAS configurado dentro de `extra.eas.projectId` para que Expo SDK 54 obtenga el push token nativo.
2. **Canal de Notificación en Android:**
   Android 8.0+ exige configurar un canal con nivel de importancia máxima (`AndroidImportance.MAX`) para permitir alertas flotantes (heads-up), sonido y vibración:
   ```typescript
   await Notifications.setNotificationChannelAsync('default', {
     name: 'Notificaciones PrestamosYA',
     importance: Notifications.AndroidImportance.MAX,
     vibrationPattern: [0, 250, 250, 250],
     sound: 'default',
   });
   ```
3. **Registro Automático:**
   Se recomienda invocar el registro del token tanto en el **Login exitoso** como al **abrir la App estando autenticado** (en `_layout.tsx`). Al ser `upsert` en el backend, no se duplican registros.

---

## 🛠️ Operación y Mantenimiento de BD

- **Limpieza de pruebas en BD:** Es 100% seguro vaciar o truncar las tablas `notifications` y `device_tokens` desde DBeaver/SQL (`TRUNCATE TABLE notifications; DELETE FROM device_tokens;`). No afectará préstamos, pagos ni la lógica de negocio.
- **Respaldo y Restauración (Dump & Restore):** Las migraciones de Prisma se persisten dentro de la tabla `_prisma_migrations`. Al hacer `pg_dump` y restaurar con `pg_restore -d db_name --no-owner`, el estado de las migraciones se mantiene al día sin requerir ejecuciones destructivas de Prisma.
