import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { GuaranteeResponseDto } from './dto/guarantee-response.dto';

export function ApiCreateGuaranteeDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear una nueva garantía para un cliente',
      description:
        'Registra una garantía asociada a un cliente del usuario autenticado.\n\n' +
        'Acepta `multipart/form-data`. El campo `image` es opcional; si se incluye, ' +
        'el backend redimensiona la imagen (máx 800x800px preservando relación de aspecto) y la convierte a WebP antes ' +
        'de guardarla en Cloudinary bajo la carpeta `{user.name}/garantias/`.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['clientId', 'type', 'description'],
        properties: {
          clientId: {
            type: 'string',
            format: 'uuid',
            example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          },
          type: {
            type: 'string',
            enum: ['VEHICLE', 'REAL_ESTATE', 'FURNITURE', 'OTHER'],
            example: 'VEHICLE',
          },
          description: {
            type: 'string',
            example: 'Motocicleta Honda Wave 110cc Placa 4589-XYZ color rojo',
          },
          estimatedValue: {
            type: 'number',
            example: 1500,
            nullable: true,
          },
          image: {
            type: 'string',
            format: 'binary',
            description:
              'Imagen de la garantía (opcional). Formatos aceptados: JPEG, PNG, WebP, GIF, BMP, TIFF. Máx 20 MB.',
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
      description:
        'Datos de entrada inválidos o formato/tamaño de imagen no permitido.',
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
        'Obtiene la lista de garantías activas de un cliente específico. ' +
        'Cada garantía incluye su array de fotos (puede estar vacío).',
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
      description: 'Retorna la garantía con su array de fotos.',
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
      description:
        'Acepta `multipart/form-data`. Si se incluye el campo `image`, ' +
        'se sube la nueva imagen a Cloudinary y se reemplaza la URL de la foto existente ' +
        '(la imagen anterior queda en Cloudinary pero su URL ya no se usa).',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['VEHICLE', 'REAL_ESTATE', 'FURNITURE', 'OTHER'],
          },
          description: { type: 'string' },
          estimatedValue: { type: 'number', nullable: true },
          image: {
            type: 'string',
            format: 'binary',
            description:
              'Nueva imagen de la garantía (opcional). Reemplaza la URL almacenada. Máx 20 MB.',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      type: GuaranteeResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Formato/tamaño de imagen no permitido.',
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
