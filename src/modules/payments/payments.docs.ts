import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiGetPaymentDashboardDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener dashboard de pagos del cobrador/administrador',
      description:
        'Devuelve las cuotas divididas en 3 secciones: cuotas que vencen hoy, cuotas en mora de días anteriores y cuotas pagadas en la fecha actual.',
    }),
    ApiResponse({
      status: 200,
      description: 'Dashboard de pagos recuperado exitosamente',
    }),
  );
}

export function ApiRegisterPaymentDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar un nuevo pago sobre un préstamo',
      description:
        'Aplica un pago al préstamo y distribuye el monto en cuotas pendientes en orden FIFO. Actualiza los saldos y estados del préstamo y las cuotas.',
    }),
    ApiResponse({
      status: 201,
      description: 'Pago registrado exitosamente',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos o el monto supera el saldo pendiente',
    }),
    ApiResponse({
      status: 404,
      description: 'Préstamo no encontrado o no pertenece al usuario',
    }),
  );
}

export function ApiVoidPaymentDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Anular un pago registrado',
      description:
        'Marca un pago como anulado (soft-void) y revierte atómicamente los montos aplicados a las cuotas y el saldo del préstamo.',
    }),
    ApiResponse({
      status: 200,
      description: 'Pago anulado exitosamente',
    }),
    ApiResponse({
      status: 400,
      description: 'El pago ya se encuentra anulado',
    }),
    ApiResponse({
      status: 404,
      description: 'Pago o préstamo no encontrado',
    }),
  );
}
