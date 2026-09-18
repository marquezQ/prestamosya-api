// src/modules/users/users.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Módulo de CUENTA de usuario (self-service): operaciones sobre MI usuario.
 *
 * Responsabilidades actuales:
 * - GET  /users/me           → perfil fresco desde BD
 * - PATCH /users/me/password → cambiar mi contraseña (requiere actual)
 *
 * Decisión de diseño: el nombre del usuario NO es editable por él mismo.
 * Lo gestiona el super admin vía PATCH /users/:id (futuro). El nombre
 * lo establece el super admin al crear la cuenta a petición del cliente.
 *
 * Aquí vivirán también las operaciones que el super admin hará sobre otros
 * prestamistas (crear, listar, deshabilitar, reset de contraseña).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve los datos frescos de "mi perfil" desde la BD (a diferencia de
   * `GET /auth/me`, que solo refleja el payload del JWT).
   */
  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   *
   * Requiere la contraseña actual como verificación. Se usa
   * `BadRequestException` (400) para errores de validación de credencial
   * (a diferencia del 401 de login) para que el frontend no lo interprete
   * como una sesión expirada.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      // Token válido pero usuario eliminado — tratar como no autorizado.
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
