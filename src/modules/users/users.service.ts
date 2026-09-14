// src/modules/users/users.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Módulo de CUENTA de usuario (self-service): operaciones sobre MI usuario.
 *
 * Separa la cuenta del usuario de la autenticación: `auth` se encarga de
 * quién soy (login, token, guards); `users` se encarga de mantener mi
 * perfil y mis credenciales.
 *
 * Aquí vivirán también las operaciones que el super admin hará sobre otros
 * prestamistas (crear, listar, deshabilitar, reset de contraseña) — campos
 * `:id` reutilizando las mismas reglas de seguridad (el `select` nunca
 * expone el `passwordHash`).
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
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return user;
  }

  /**
   * Actualiza el perfil del usuario autenticado.
   *
   * Solo el campo `name` es editable (el `username` no). Devuelve los datos
   * frescos del usuario para que el frontend actualice su estado local.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    // `select` garantiza que NUNCA se devuelva el passwordHash.
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
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
