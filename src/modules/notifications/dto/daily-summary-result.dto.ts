import { ApiProperty } from '@nestjs/swagger';
import { PushSendResult } from '../providers/push-provider.port';

/**
 * DTO swagger de UN resultado de resumen diario entregado a un admin.
 * (Web y APK consumen la MÍSMA REST → este shape es idéntico en ambos.)
 */
export class DailySummaryResultDto {
  @ApiProperty({ description: 'Admin destinatario (userId)' })
  userId: string;

  @ApiProperty({ description: 'Clientes DISTINTOS en mora' })
  overdueClients: number;

  @ApiProperty({ description: 'Cobros programados HOY' })
  dueTodayCount: number;

  @ApiProperty({
    description: 'Canal in-app entregado (siempre salvo fallo DB)',
  })
  inAppDelivered: boolean;

  @ApiProperty({
    description: 'Push Expo aceptados (0 si no hay tokens/config)',
  })
  pushAccepted: number;

  @ApiProperty({ description: 'Push Expo fallidos' })
  pushFailed: number;
}

/**
 * Shape de negocio (mismos campos que el DTO, pero con `push` tipado fino).
 */
export type DailySummaryResult = Omit<
  DailySummaryResultDto,
  'pushAccepted' | 'pushFailed'
> & {
  push: PushSendResult;
};
