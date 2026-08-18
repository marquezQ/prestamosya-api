import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
import { GuaranteeResponseDto } from './dto/guarantee-response.dto';
import { UpdateGuaranteeDto } from './dto/update-guarantee.dto';

export function ApiCreateGuaranteeDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear una nueva garantía para un cliente',
      description:
        'Registra una garantía asociada a un cliente del usuario autenticado.',
    }),
    ApiBody({
      type: CreateGuaranteeDto,
      examples: {
        ejemplo: {
          summary: 'Garantía Vehicular',
          value: {
            clientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            type: 'VEHICLE',
            description: 'Motocicleta Honda Wave 110cc Placa 4589-XYZ',
            estimatedValue: 1500,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Garantía creada exitosamente.',
      type: GuaranteeResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Datos de entrada inválidos.',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description:
        'Cliente no encontrado o no pertenece al usuario autenticado.',
    }),
  );
}

export function ApiGetGuaranteesByClientDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar garantías de un cliente',
      description:
        'Obtiene la lista de garantías activas de un cliente específico.',
    }),
    ApiQuery({
      name: 'clientId',
      required: true,
      description: 'ID del cliente',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Lista de garantías.',
      type: [GuaranteeResponseDto],
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Cliente no encontrado.',
    }),
  );
}

export function ApiGetGuaranteeByIdDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener detalle de una garantía',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      type: GuaranteeResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Garantía no encontrada.',
    }),
  );
}

export function ApiUpdateGuaranteeDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar una garantía',
    }),
    ApiBody({ type: UpdateGuaranteeDto }),
    ApiResponse({
      status: HttpStatus.OK,
      type: GuaranteeResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Garantía no encontrada.',
    }),
  );
}

export function ApiDeleteGuaranteeDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Eliminar una garantía (Soft Delete)',
      description:
        'Marca la garantía como eliminada. No permitido si la garantía está en estado IN_USE.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Garantía eliminada exitosamente.',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'No se puede eliminar una garantía en uso (IN_USE).',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Garantía no encontrada.',
    }),
  );
}
