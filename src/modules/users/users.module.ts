// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Módulo de CUENTA de usuario: self-service (me) hoy, administración de
 * prestamistas (:/id) cuando llegue el super admin.
 *
 * No necesita imports adicionales: PrismaModule es @Global().
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
