import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthResponseDto } from './dto/auth-response.dto';

// Documentación de Swagger para el endpoint POST /auth/login
export function ApiLoginDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Iniciar sesión',
      description: 'Autentica al usuario. Retorna un JWT de acceso.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Login exitoso.',
      type: AuthResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Credenciales inválidas.',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Datos de entrada inválidos.',
    }),
  );
}

// Documentación de Swagger para el endpoint GET /auth/me
export function ApiMeDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener usuario autenticado',
      description: 'Retorna los datos del usuario extraídos del JWT.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Datos del usuario autenticado.',
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Token ausente, expirado o inválido.',
    }),
  );
}
