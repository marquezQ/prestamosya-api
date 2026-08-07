import { PrismaService } from '../prisma/prisma.service';

/**
 * Interfaz mínima del mock de PrismaService: solo los delegados que usan los
 * services bajo test, sin arrastrar todo el esqueleto de PrismaClient.
 */
export interface PrismaServiceMock {
  user: {
    findUnique: jest.Mock;
  };
  client: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    $transaction: jest.Mock;
  };
  $connect: jest.Mock;
  $disconnect: jest.Mock;
}

/** Fábrica de un mock limpio de PrismaService: cada `jest.fn()` es nuevo. */
export function createPrismaMock(): PrismaServiceMock {
  return {
    user: {
      findUnique: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      $transaction: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}

/** Convierte el mock en el tipo PrismaService para inyectarlo en un service. */
export function prismaServiceOf(mock: PrismaServiceMock): PrismaService {
  return mock as unknown as PrismaService;
}

/**
 * Último argumento `index` de la última llamada al mock, con tipado.
 * Evita acceder a `mock.calls` (tipado `any`) que rompe las reglas de eslint.
 */
export function lastCallArg<T>(mock: jest.Mock, index = 0): T {
  const calls = mock.mock.calls as unknown as T[][];
  const call = calls[calls.length - 1];
  return call[index];
}
