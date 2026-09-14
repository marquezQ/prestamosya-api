import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// `bcrypt.compare` y `bcrypt.hash` no son re-reescribibles con spyOn,
// así que se mockea el módulo completo para controlar el resultado sin
// llamar a bcrypt real.
jest.mock('bcrypt', () => ({
  ...jest.requireActual<typeof import('bcrypt')>('bcrypt'),
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, prismaServiceOf } from '../../testing/prisma.mock';

/**
 * Unit tests de UsersService (cuenta de usuario / self-service): prueba
 * getProfile, updateProfile y changePassword con mocks (Prisma/bcrypt),
 * sin BD. Cubre la seguridad (nunca filtrar passwordHash) y los errores.
 */
describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  /** Usuario de referencia devuelto por el mock de Prisma. */
  const baseUser = {
    id: 'user-1',
    name: 'Admin Uno',
    username: 'admin',
    role: 'admin',
    isActive: true,
    passwordHash: 'hashed-not-to-leak',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    // Por defecto la comparación de contraseña es exitosa.
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    // Por defecto el hasheo devuelve un valor determinista.
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

    // Preparamos el módulo de testing con las dependencias sustituidas.
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaServiceOf(prismaMock) },
      ],
    }).compile();

    service = moduleRef.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getProfile()', () => {
    it('devuelve los datos frescos del usuario con select seguro', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getProfile('user-1');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
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
      expect(result.name).toBe('Admin Uno');
      expect(result.isActive).toBe(true);
    });

    it('nunca devuelve passwordHash en la respuesta', async () => {
      // El mock resuelve el resultado del `select` (que omite passwordHash).
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Admin Uno',
        username: 'admin',
        role: 'admin',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.getProfile('user-1');

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile()', () => {
    it('actualiza solo el nombre con el userId y devuelve datos frescos', async () => {
      prismaMock.user.update.mockResolvedValue({
        ...baseUser,
        name: 'Nuevo Nombre',
      });

      const result = await service.updateProfile('user-1', {
        name: 'Nuevo Nombre',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Nuevo Nombre' },
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
      expect(result.name).toBe('Nuevo Nombre');
    });

    it('nunca devuelve passwordHash en la respuesta', async () => {
      // El mock resuelve el resultado del `select` (que omite passwordHash).
      prismaMock.user.update.mockResolvedValue({
        id: 'user-1',
        name: 'Nuevo Nombre',
        username: 'admin',
        role: 'admin',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await service.updateProfile('user-1', {
        name: 'Nuevo Nombre',
      });

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword()', () => {
    it('hashea la nueva contraseña (12 rounds) y actualiza el passwordHash', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);
      prismaMock.user.update.mockResolvedValue({
        ...baseUser,
        passwordHash: 'new-hashed-password',
      });

      const result = await service.changePassword('user-1', {
        currentPassword: 'admin123',
        newPassword: 'nueva123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('nueva123', 12);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
      expect(result.message).toBeDefined();
    });

    it('lanza BadRequestException si la contraseña actual es incorrecta', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'incorrecta',
          newPassword: 'nueva123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la nueva contraseña es igual a la actual', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);
      // La contraseña actual es válida (compare = true), pero no se permite
      // dejar la misma contraseña.
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'admin123',
          newPassword: 'admin123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no actualiza el passwordHash si la contraseña actual es incorrecta', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'incorrecta',
          newPassword: 'nueva123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });
});
