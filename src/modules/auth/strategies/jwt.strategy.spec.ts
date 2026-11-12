import { UnauthorizedException } from '@nestjs/common';

import { JwtStrategy } from './jwt.strategy';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Unit tests de JwtStrategy.
 *
 * validate() ahora es async y consulta la BD para verificar isActive y obtener
 * el role fresco. Se mockea PrismaService para aislar el test.
 */
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaMock: Partial<PrismaService>;
  const secret = 'test-jwt-secret';

  const activeAdminUser = { id: 'user-1', isActive: true, role: 'admin' };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;

    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(activeAdminUser),
      } as unknown as PrismaService['user'],
    };

    strategy = new JwtStrategy(prismaMock as PrismaService);
  });

  describe('validate()', () => {
    it('devuelve el payload con role fresco desde BD cuando el usuario está activo', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        name: 'Admin Uno',
        username: 'admin',
        role: 'admin',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({ ...payload, role: 'admin' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaMock.user!.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, isActive: true, role: true },
      });
    });

    it('refleja cambio de rol: si el usuario era admin y ahora es superadmin, retorna superadmin', async () => {
      (prismaMock.user!.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        isActive: true,
        role: 'superadmin',
      });

      const payload: JwtPayload = {
        sub: 'user-1',
        name: 'Admin Uno',
        username: 'admin',
        role: 'admin', // rol viejo en el token
      };

      const result = await strategy.validate(payload);

      expect(result.role).toBe('superadmin'); // role fresco desde BD
    });

    it('lanza UnauthorizedException si el payload no tiene sub', async () => {
      await expect(
        strategy.validate({ username: 'admin', role: 'admin' } as JwtPayload),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario no existe en BD', async () => {
      (prismaMock.user!.findUnique as jest.Mock).mockResolvedValue(null);

      const payload: JwtPayload = {
        sub: 'user-inexistente',
        name: 'Ghost',
        username: 'ghost',
        role: 'admin',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lanza UnauthorizedException si el usuario está desactivado', async () => {
      (prismaMock.user!.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        isActive: false,
        role: 'admin',
      });

      const payload: JwtPayload = {
        sub: 'user-1',
        name: 'Admin Desactivado',
        username: 'admin',
        role: 'admin',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
