import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// `bcrypt.compare` no es re-reescribible con spyOn, así que se mockea el
// módulo completo para controlar el resultado sin llamar a bcrypt real.
jest.mock('bcrypt', () => ({
  ...jest.requireActual<typeof import('bcrypt')>('bcrypt'),
  compare: jest.fn(),
}));

import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, prismaServiceOf } from '../../testing/prisma.mock';

/**
 * Unit tests de AuthService: prueba la lógica de login con mocks
 * (Prisma/JWT), sin BD. Cubre la seguridad (nunca filtrar passwordHash),
 * los 401 sin revelar si el usuario existe, y el payload del token.
 */
describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let jwtSign: jest.Mock;

  /** Usuario de referencia devuelto por el mock de Prisma. */
  const baseUser = {
    id: 'user-1',
    name: 'Admin Uno',
    username: 'admin',
    role: 'admin',
    isActive: true,
    passwordHash: 'hashed-not-to-leak',
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    jwtSign = jest.fn().mockReturnValue('signed-token');

    // Por defecto la comparación de contraseña es exitosa.
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // Preparamos el módulo de testing con las dependencias sustituidas.
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaServiceOf(prismaMock) },
        {
          provide: JwtService,
          useValue: { sign: jwtSign },
        },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('login()', () => {
    it('devuelve el accessToken firmado', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);
      const result = await service.login({
        username: 'admin',
        password: 'admin123',
      });

      expect(result.accessToken).toBe('signed-token');
    });

    it('firma el payload con { username, role }', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);

      await service.login({ username: 'admin', password: 'admin123' });

      expect(jwtSign).toHaveBeenCalledWith({
        sub: 'user-1',
        name: 'Admin Uno',
        username: 'admin',
        role: 'admin',
      });
    });

    it('nunca devuelve passwordHash en la propiedad user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.login({
        username: 'admin',
        password: 'admin123',
      });

      // INVARIANTE CRÍTICO: el hash nunca debe filtrarse al cliente.
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ username: 'noexiste', password: 'admin123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario está inactivo', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...baseUser,
        isActive: false,
      });

      await expect(
        service.login({ username: 'admin', password: 'admin123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);
      // Forzamos que bcrypt falle la comparación.
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'admin', password: 'incorrecta' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
