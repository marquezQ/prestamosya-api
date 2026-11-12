import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Guard de autorización por rol. Corre DESPUÉS de JwtAuthGuard (que autentica).
 *
 * Comportamiento:
 * - Si la ruta no tiene @Roles() → pasa sin restricción (compatible con todos los endpoints existentes).
 * - Si la ruta tiene @Roles('superadmin') → solo usuarios con ese rol pueden acceder.
 * - Lanza 403 ForbiddenException si el usuario no tiene el rol requerido.
 *
 * El rol se lee de req.user (inyectado por JwtStrategy.validate() con valor
 * fresco desde la BD, no el del JWT original).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin @Roles() → acceso libre para cualquier usuario autenticado
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'No tenés permiso para acceder a este recurso',
      );
    }

    return true;
  }
}
