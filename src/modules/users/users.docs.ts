// src/modules/users/users.docs.ts
import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

// Documentación de Swagger para GET /users/me
export function ApiGetProfileDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener perfil del usuario autenticado',
      description:
        'Devuelve los datos frescos del usuario desde la base de datos ' +
        '(a diferencia de GET /auth/me, que solo refleja el payload del JWT).',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Perfil del usuario autenticado.',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Token ausente, expirado o inválido.',
    }),
  );
}

// Documentación de Swagger para PATCH /users/me
export function ApiUpdateProfileDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar perfil del usuario',
      description:
        'Actualiza el nombre del usuario autenticado. El `username` NO es ' +
        'editable. Devuelve los datos frescos del usuario (sin `passwordHash`).',
    }),
    ApiBody({ type: UpdateProfileDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Perfil actualizado.',
      type: UserResponseDto,
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

// Documentación de Swagger para PATCH /users/me/password
export function ApiChangePasswordDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cambiar contraseña',
      description:
        'Cambia la contraseña del usuario autenticado. Requiere la ' +
        'contraseña actual como verificación. Endpoint separado del de ' +
        'edición de perfil.',
    }),
    ApiBody({ type: ChangePasswordDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Contraseña actualizada.',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'Contraseña actual incorrecta, nueva contraseña igual a la actual o datos inválidos.',
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Token ausente, expirado o inválido.',
    }),
  );
}
