/**
 * Puerto de canal de entrega in-app (REST persistente en `notifications`).
 *
 * Único canal FIABLE requerido: funciona en la web y en el APK consumiendo la
 * MISMA REST. El push (Expo) es un canal OPCIONAL sobre este.
 */
export const NotificationChannelPortToken = Symbol(
  'NotificationChannelPortToken',
);
export const NotificationChannelPort = NotificationChannelPortToken;

export interface NotificationChannelInput {
  userId: string;
  type: 'DAILY_SUMMARY' | 'DAILY_OVERDUE' | 'PAYMENT_DUE' | 'SYSTEM';
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

/** Firma que debe cumplir TODO canal de notificación (in-app / push). */
export interface NotificationChannelSender {
  send(input: NotificationChannelInput): Promise<boolean>;
}
