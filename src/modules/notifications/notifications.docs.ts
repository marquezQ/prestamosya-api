import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { NotificationItemDto } from './dto/notification-item.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { DailySummaryResultDto } from './dto/daily-summary-result.dto';

/**
 * GET /api/notifications
 * Lista paginada de notificaciones in-app del usuario autenticado.
 */
export function ApiListNotificationsDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lista paginada de notificaciones',
      description:
        'Devuelve la bandeja de entrada de notificaciones del usuario autenticado. ' +
        'Ordenadas de más reciente a más antigua. ' +
        'Soporta filtrado por no-leídas (`unreadOnly=true`) y por tipo (`type`).',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      default: 1,
      description: 'Número de página (≥ 1).',
    }),
    ApiQuery({
      name: 'perPage',
      required: false,
      type: Number,
      default: 20,
      description: 'Items por página (1–50).',
    }),
    ApiQuery({
      name: 'unreadOnly',
      required: false,
      type: Boolean,
      default: false,
      description: 'Si `true`, devuelve solo notificaciones no leídas.',
    }),
    ApiQuery({
      name: 'type',
      required: false,
      enum: ['DAILY_SUMMARY', 'DAILY_OVERDUE', 'PAYMENT_DUE', 'SYSTEM'],
      description: 'Filtra por tipo de notificación.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Lista de notificaciones paginada.',
      type: NotificationItemDto,
      isArray: true,
    }),
  );
}

/**
 * GET /api/notifications/unread-count
 * Devuelve el total de notificaciones no leídas del usuario autenticado.
 * Usado para mostrar el badge (campanita) en la navegación.
 */
export function ApiUnreadCountDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Contador de notificaciones no leídas',
      description:
        'Devuelve un entero con la cantidad de notificaciones in-app ' +
        'pendientes de leer. Útil para renderizar el badge de la campanita ' +
        'en la barra de navegación del APK o del frontend web.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Número de notificaciones no leídas.',
      schema: { type: 'integer', example: 3 },
    }),
  );
}

/**
 * PATCH /api/notifications/:id/read
 * Marca una notificación específica como leída.
 */
export function ApiMarkAsReadDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Marcar notificación como leída',
      description:
        'Registra la fecha/hora de lectura de una notificación específica ' +
        'del usuario autenticado. Si ya estaba leída o no pertenece al usuario, ' +
        'devuelve `false` sin error.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la notificación a marcar como leída.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description:
        '`true` si se marcó, `false` si ya estaba leída o no existe.',
      schema: { type: 'boolean' },
    }),
  );
}

/**
 * PATCH /api/notifications/read-all
 * Marca todas las notificaciones no leídas del usuario como leídas.
 */
export function ApiMarkAllAsReadDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Marcar todas las notificaciones como leídas',
      description:
        'Actualiza masivamente todas las notificaciones no leídas del usuario ' +
        'autenticado. Devuelve la cantidad de registros actualizados.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Cantidad de notificaciones marcadas como leídas.',
      schema: { type: 'integer', example: 5 },
    }),
  );
}

/**
 * POST /api/notifications/device-tokens
 * Registra el token de push del dispositivo (Expo / FCM / WebPush).
 * Debe llamarse al iniciar sesión o cuando expo-notifications entregue un nuevo token.
 */
export function ApiRegisterDeviceTokenDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar token de dispositivo para push',
      description:
        'Registra el token de push notifications del dispositivo del usuario. ' +
        'Para React Native (Expo): obtener con `Notifications.getExpoPushTokenAsync()` ' +
        'y enviarlo con `platform: "expo"`. ' +
        'Usa upsert internamente: si el mismo token ya existe, no lo duplica. ' +
        'Debe invocarse al iniciar sesión y cada vez que Expo entregue un token nuevo.',
    }),
    ApiBody({ type: RegisterDeviceTokenDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Token registrado (o ya existía, no se duplicó).',
    }),
  );
}

/**
 * DELETE /api/notifications/device-tokens
 * Elimina el token de push del dispositivo. Debe llamarse al cerrar sesión.
 */
export function ApiUnregisterDeviceTokenDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Eliminar token de dispositivo (logout)',
      description:
        'Elimina el token de push del dispositivo del usuario autenticado. ' +
        'Debe invocarse al cerrar sesión para que el usuario no reciba ' +
        'notificaciones push en un dispositivo que ya cerró sesión. ' +
        'Si el token no existe, responde 200 sin error.',
    }),
    ApiBody({ type: RegisterDeviceTokenDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Token eliminado (o no existía).',
    }),
  );
}

/**
 * POST /api/notifications/trigger-daily-summary
 * Dispara manualmente el resumen diario. Solo administradores.
 */
export function ApiTriggerDailySummaryDoc() {
  return applyDecorators(
    ApiOperation({
      summary: '[Admin] Dispara el resumen diario manualmente',
      description:
        'Ejecuta el mismo proceso que el cron de las 8:00 AM (America/La_Paz) ' +
        'de forma inmediata. Itera sobre todos los administradores activos y ' +
        'les entrega: (1) notificación in-app en la bandeja y ' +
        '(2) push al dispositivo registrado (si tiene token Expo). ' +
        'Útil para pruebas sin esperar al horario programado. ' +
        'Solo accesible por usuarios con role = admin.',
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Resumen enviado a cada administrador activo.',
      type: DailySummaryResultDto,
      isArray: true,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'El usuario autenticado no tiene rol de administrador.',
    }),
  );
}
