import { SetMetadata } from '@nestjs/common';

/**
 * Clave de metadata usada por RolesGuard para leer los roles requeridos.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator que declara qué roles pueden acceder a un controlador o handler.
 *
 * Uso en clase (aplica a todos los endpoints del controller):
 *   @Roles('superadmin')
 *   @Controller('superadmin/users')
 *
 * Uso en handler individual:
 *   @Roles('superadmin')
 *   @Get()
 *
 * Si no se usa @Roles(), RolesGuard deja pasar a cualquier usuario autenticado.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
