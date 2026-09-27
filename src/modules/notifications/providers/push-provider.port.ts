/**
 * Puerto de provider de push (Expo Push Service). Opcional: si no hay tokens
 * ni EXPO_ACCESS_TOKEN, todo sigue 100% in-app vía REST.
 */
export const PushProviderPortToken = Symbol('PushProviderPortToken');
export const PushProviderPort = PushProviderPortToken;

export interface PushSendResult {
  accepted: number;
  failed: number;
}

export interface PushSender {
  sendToUser(
    userId: string,
    input: { title: string; body: string; payload?: Record<string, unknown> },
  ): Promise<PushSendResult>;
}
