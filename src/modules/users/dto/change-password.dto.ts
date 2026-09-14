// src/modules/users/dto/change-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO para cambiar la contraseña del usuario autenticado.
 *
 * Es un endpoint separado del de edición de perfil: el cambio de credencial
 * siempre requiere la contraseña actual como verificación.
 *
 * (El super admin tendrá después su propio endpoint `POST /users/:id/reset-password`
 * que NO requerirá la contraseña actual.)
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual del usuario',
    default: 'admin123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty({
    description: 'Nueva contraseña (mínimo 6 caracteres)',
    default: 'nueva123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
