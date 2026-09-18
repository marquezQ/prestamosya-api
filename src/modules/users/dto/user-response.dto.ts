// src/modules/users/dto/user-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

/**
 * Forma canónica de respuesta de un usuario: id, name, username, role,
 * isActive, createdAt, updatedAt.
 *
 * La usan las rutas de "mi cuenta" (self-service). Cuando llegue el super
 * admin, esta será también la forma de respuesta para listar/crear
 * prestamistas (`GET /users`, `POST /users`, etc.).
 */
export class UserResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'Administrador Principal' })
  name: string;

  @ApiProperty({ example: 'admin' })
  username: string;

  @ApiProperty({ example: 'admin', enum: ['admin', 'collector'] })
  role: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
