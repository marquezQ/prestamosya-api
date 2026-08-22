import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiRecalculateOverdueDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Forzar recálculo manual de mora (Admin / Fallback)',
      description:
        'Ejecuta de forma síncrona e idempotente el proceso de recálculo de cuotas vencidas, días de mora y estado moroso de clientes. Usado como respaldo si el servidor no ejecutó el cron automático a las 6:00 AM.',
    }),
    ApiResponse({
      status: 200,
      description: 'Recálculo ejecutado exitosamente',
    }),
  );
}
