// src/modules/users/users.controller.ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UsersService } from './users.service';
import { ApiChangePasswordDoc, ApiGetProfileDoc } from './users.docs';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Rutas de "mi cuenta" (self-service), protegidas por el JwtAuthGuard global.
 *
 * Nota de diseño: las rutas estáticas (`me`) se declaran ANTES que las
 * dinámicas (`/:id`) para que mañana el super admin agregue sin fricción:
 *   GET/POST /users              → listar/crear prestamistas
 *   GET/PATCH /users/:id         → detalle / editar nombre / habilitar-deshabilitar
 *   POST /users/:id/reset-password → reset de contraseña de un prestamista
 *
 * Decisión: PATCH /users/me (editar nombre propio) NO existe. El nombre
 * lo gestiona el super admin vía PATCH /users/:id. El usuario autenticado
 * solo puede consultar su perfil y cambiar su contraseña.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiGetProfileDoc()
  getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me/password')
  @ApiChangePasswordDoc()
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(user.sub, changePasswordDto);
  }
}
