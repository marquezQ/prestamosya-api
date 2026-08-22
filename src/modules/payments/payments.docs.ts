import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

export function ApiGetPaymentDashboardDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener dashboard dinámico de pagos del cobrador/administrador',
      description:
        'Devuelve las cuotas divididas en 3 secciones para la fecha dada (o fecha de hoy por defecto): cuotas que vencen ese día, cuotas en mora y cuotas pagadas en esa fecha.',
    }),
    ApiQuery({
      name: 'date',
      required: false,
      description:
        'Fecha seleccionada en el carrusel de la UI (formato YYYY-MM-DD). Si se omite, usa la fecha de hoy.',
      example: '2026-08-20',
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
