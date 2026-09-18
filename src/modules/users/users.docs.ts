// src/modules/users/users.docs.ts
import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChangePasswordDto } from './dto/change-password.dto';
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

// Documentación de Swagger para PATCH /users/me/password
export function ApiChangePasswordDoc() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cambiar contraseña',
      description:
        'Cambia la contraseña del usuario autenticado. Requiere la ' +
        'contraseña actual como verificación. ' +
        'Responde 400 (no 401) ante credencial incorrecta para que el ' +
        'interceptor de sesión expirada del cliente no cierre la sesión.',
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
