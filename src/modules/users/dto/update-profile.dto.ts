// src/modules/users/dto/update-profile.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO para actualizar el perfil del usuario autenticado.
 *
 * Solo el campo `name` es editable. El `username` NO es editable (es el
 * identificador de login). `role` e `isActive` tampoco son editables por el
 * usuario (los controla el sistema).
 */
export class UpdateProfileDto {
  @ApiProperty({
    description: 'Nombre completo del usuario',
    default: 'Pedro Suárez',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
