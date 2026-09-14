// src/modules/users/users.controller.ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UsersService } from './users.service';
import {
  ApiChangePasswordDoc,
  ApiGetProfileDoc,
  ApiUpdateProfileDoc,
} from './users.docs';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Rutas de "mi cuenta" (self-service), protegidas por el JwtAuthGuard global.
 *
 * Nota de diseño: las rutas estáticas (`me`) se declaran ANTES que las
 * dinámicas (`/:id`) para que mañana el super admin agregue sin fricción:
 *   GET/POST /users           → listar/crear prestamistas
 *   GET/PATCH /users/:id      → detalle / habilitar-deshabilitar
 *   POST /users/:id/reset-password → reset de contraseña de un prestamista
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

  @Patch('me')
  @ApiUpdateProfileDoc()
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user.sub, updateProfileDto);
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
