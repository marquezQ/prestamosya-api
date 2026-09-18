// src/modules/business-config/business-config.docs.ts
import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BusinessConfigResponseDto } from './dto/business-config-response.dto';

// Documentación de Swagger para GET /business-config
export function ApiGetBusinessConfigDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener configuración del negocio',
      description:
        'Devuelve la configuración del usuario autenticado. Si aún no existe, ' +
        'se crea automáticamente con los valores por defecto del esquema.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Configuración del negocio.',
      type: BusinessConfigResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Token ausente, expirado o inválido.',
    }),
  );
}

// Documentación de Swagger para PATCH /business-config
export function ApiUpdateBusinessConfigDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar configuración del negocio',
      description:
        'Actualización parcial: solo se persisten los campos enviados. ' +
        'Si el usuario aún no tiene configuración, se crea con los valores facilitados.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Configuración actualizada.',
      type: BusinessConfigResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Datos de entrada inválidos.',
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Token ausente, expirado o inválido.',
    }),
  );
}
