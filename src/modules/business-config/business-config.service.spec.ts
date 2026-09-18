// src/modules/business-config/business-config.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from 'decimal.js';
import { BusinessConfigService } from './business-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createPrismaMock,
  lastCallArg,
  prismaServiceOf,
} from '../../testing/prisma.mock';

/**
 * Unit tests de BusinessConfigService: prueba la lógica de upsert
 * (auto-creación con defaults), la actualización parcial (solo campos
 * enviados) y la conversión Decimal → number / number → string.
 */
describe('BusinessConfigService', () => {
  let service: BusinessConfigService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  /** Configuración de referencia devuelta por el mock de Prisma. */
  const baseConfig = {
    id: 'config-1',
    userId: 'user-1',
    businessName: null,
    primaryCurrency: 'BOB' as const,
    exchangeRate: new Decimal('6.96'),
    defaultInterestRate: null,
    defaultPeriodType: null,
    graceDays: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessConfigService,
        { provide: PrismaService, useValue: prismaServiceOf(prismaMock) },
      ],
    }).compile();

    service = moduleRef.get<BusinessConfigService>(BusinessConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getForUser()', () => {
    it('retorna la configuración existente sin alterarla', async () => {
      prismaMock.businessConfig.upsert.mockResolvedValue(baseConfig);

      const result = await service.getForUser('user-1');

      expect(result.businessName).toBeNull();
      expect(result.primaryCurrency).toBe('BOB');
      expect(result.graceDays).toBe(0);
    });

    it('convierte las columnas Decimal a number en la respuesta', async () => {
      prismaMock.businessConfig.upsert.mockResolvedValue(baseConfig);

      const result = await service.getForUser('user-1');

      expect(result.exchangeRate).toBe(6.96);
      expect(result.defaultInterestRate).toBeNull();
    });

    it('crea con defaults si no existe (upsert sin update)', async () => {
      prismaMock.businessConfig.upsert.mockResolvedValue(baseConfig);

      await service.getForUser('user-1');

      const arg = lastCallArg<{
        where: { userId: string };
        create: { userId: string };
        update: Record<string, never>;
      }>(prismaMock.businessConfig.upsert);

      expect(arg.create).toEqual({ userId: 'user-1' });
      expect(arg.update).toEqual({});
    });
  });

  describe('updateForUser()', () => {
    it('solo incluye los campos enviados en update (los undefined se descartan)', async () => {
      prismaMock.businessConfig.upsert.mockResolvedValue(baseConfig);

      await service.updateForUser('user-1', { graceDays: 3 });

      const arg = lastCallArg<{
        update: Record<string, unknown>;
      }>(prismaMock.businessConfig.upsert);

      expect(arg.update).toEqual({ graceDays: 3 });
    });

    it('serializa las columnas Decimal como string para Prisma', async () => {
      prismaMock.businessConfig.upsert.mockResolvedValue(baseConfig);

      await service.updateForUser('user-1', {
        exchangeRate: 7.1,
        defaultInterestRate: 12,
      });

      const arg = lastCallArg<{
        update: Record<string, unknown>;
      }>(prismaMock.businessConfig.upsert);

      expect(arg.update.exchangeRate).toBe('7.1');
      expect(arg.update.defaultInterestRate).toBe('12');
    });

    it('propaga los campos enviados al create cuando no existe la config', async () => {
      prismaMock.businessConfig.upsert.mockResolvedValue({
        ...baseConfig,
        businessName: 'Préstamos Ya',
        graceDays: 5,
      });

      await service.updateForUser('user-1', {
        businessName: 'Préstamos Ya',
        graceDays: 5,
      });

      const arg = lastCallArg<{
        create: Record<string, unknown>;
      }>(prismaMock.businessConfig.upsert);

      expect(arg.create.businessName).toBe('Préstamos Ya');
      expect(arg.create.graceDays).toBe(5);
    });

    it('retorna la configuración actualizada con Decimal → number', async () => {
      prismaMock.businessConfig.upsert.mockResolvedValue({
        ...baseConfig,
        businessName: 'Préstamos Ya',
        exchangeRate: new Decimal('7.10'),
        defaultInterestRate: new Decimal('12.00'),
        graceDays: 3,
      });

      const result = await service.updateForUser('user-1', {
        businessName: 'Préstamos Ya',
      });

      expect(result.businessName).toBe('Préstamos Ya');
      expect(result.exchangeRate).toBe(7.1);
      expect(result.defaultInterestRate).toBe(12);
      expect(result.graceDays).toBe(3);
    });
  });
});
