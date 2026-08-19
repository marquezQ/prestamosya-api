import { ConflictException, NotFoundException } from '@nestjs/common';

import { ClientsService } from './clients.service';
import {
  createPrismaMock,
  lastCallArg,
  prismaServiceOf,
} from '../../testing/prisma.mock';

/**
 * Unit tests de ClientsService: se inyecta un mock de Prisma (sin BD) para
 * probar solo la lógica del service.
 *
 * Casos clave:
 * - `findAll()` agrega `activeLoanCount` consultando los préstamos activos.
 * - `findOne()` separa los préstamos en `activeLoans` y `completedLoans` sin
 *   arrastrar cuotas, y no expone resumen financiero.
 */
describe('ClientsService', () => {
  let service: ClientsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  /** Utilidad: convierte un número en un objeto con `.toString()` (simula Decimal de Prisma). */
  const dec = (n: number) => ({ toString: () => n.toFixed(2) });

  /** Cliente base sin relaciones (para findAll). */
  const baseClient = {
    id: 'client-1',
    userId: 'user-1',
    fullName: 'Ana Pérez',
    phone: '71234567',
    idNumber: '5555555 LP',
    phoneAlt: null,
    address: 'Av. Arce 123',
    latitude: dec(-16.5001),
    longitude: dec(-68.1342),
    status: 'CURRENT',
    notes: 'Prefiere mañanas',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  /** Cliente con préstamos (ACTIVE y COMPLETED) y una garantía (para findOne). */
  const multiLoanClient = {
    ...baseClient,
    guarantees: [
      {
        id: 'guarantee-1',
        type: 'VEHICLE',
        description: 'Toyota',
        estimatedValue: dec(15000),
        status: 'IN_USE',
        createdAt: new Date('2026-01-01'),
      },
    ],
    loans: [
      {
        id: 'loan-bob',
        mode: 'automatic',
        capitalAmount: dec(1000),
        currency: 'BOB',
        interestRate: dec(10),
        periodType: 'monthly',
        totalInstallments: 3,
        totalAmount: dec(1300),
        totalPaid: dec(650),
        outstandingBalance: dec(650),
        status: 'ACTIVE',
        startDate: new Date('2026-01-03'),
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'loan-usd',
        mode: 'manual',
        capitalAmount: dec(300),
        currency: 'USD',
        interestRate: dec(0),
        periodType: null,
        totalInstallments: 2,
        totalAmount: dec(300),
        totalPaid: dec(300),
        outstandingBalance: dec(0),
        status: 'COMPLETED',
        startDate: new Date('2026-01-05'),
        createdAt: new Date('2026-01-02'),
      },
    ],
  };

  beforeEach(() => {
    prismaMock = createPrismaMock();
    service = new ClientsService(prismaServiceOf(prismaMock));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findAll()', () => {
    it('devuelve activeLoanCount 0 cuando el cliente no tiene préstamos activos', async () => {
      prismaMock.client.findMany.mockResolvedValue([baseClient]);
      prismaMock.loan.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-1');

      expect(result.data[0].activeLoanCount).toBe(0);
    });

    it('cuenta un préstamo activo por cliente', async () => {
      prismaMock.client.findMany.mockResolvedValue([baseClient]);
      prismaMock.loan.findMany.mockResolvedValue([{ clientId: 'client-1' }]);

      const result = await service.findAll('user-1');

      expect(result.data[0].activeLoanCount).toBe(1);
    });

    it('cuenta correctamente el número de préstamos activos por cliente', async () => {
      prismaMock.client.findMany.mockResolvedValue([baseClient]);
      prismaMock.loan.findMany.mockResolvedValue([
        { clientId: 'client-1' },
        { clientId: 'client-1' },
        { clientId: 'client-1' },
      ]);

      const result = await service.findAll('user-1');

      expect(result.data[0].activeLoanCount).toBe(3);
    });

    it('no consulta préstamos si no hay clientes', async () => {
      prismaMock.client.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-1');

      expect(result.data).toHaveLength(0);
      expect(prismaMock.loan.findMany).not.toHaveBeenCalled();
    });
  });

  describe('create()', () => {
    it('lanza ConflictException si el CI está duplicado (P2002)', async () => {
      prismaMock.client.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create('user-1', {
          fullName: 'Juan',
          phone: '70000000',
          idNumber: '4444444',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update()', () => {
    it('solo actualiza los campos presentes (no undefined)', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);
      prismaMock.client.update.mockResolvedValue(multiLoanClient);

      await service.update('user-1', 'client-1', { fullName: 'Nuevo Nombre' });

      expect(prismaMock.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1', userId: 'user-1', deletedAt: null },
        data: { fullName: 'Nuevo Nombre' },
      });
    });

    it('lanza ConflictException si el CI duplica otro existente (P2002)', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);
      prismaMock.client.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.update('user-1', 'client-1', { idNumber: '1111111' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove()', () => {
    it('hace soft delete (setea deletedAt, no borra físicamente)', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);
      prismaMock.client.update.mockResolvedValue(multiLoanClient);

      await service.remove('user-1', 'client-1');

      const removeCall = lastCallArg<{
        where: { id: string };
        data: { deletedAt: Date };
      }>(prismaMock.client.update);
      expect(removeCall.where.id).toBe('client-1');
      expect(removeCall.data.deletedAt).toBeInstanceOf(Date);
      expect(prismaMock.client.delete).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('lanza NotFoundException si el cliente no existe o es de otro admin', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-2', 'client-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('separa los préstamos en activeLoans y completedLoans', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');

      expect(result.data.activeLoans).toHaveLength(1);
      expect(result.data.activeLoans[0].id).toBe('loan-bob');
      expect(result.data.completedLoans).toHaveLength(1);
      expect(result.data.completedLoans[0].id).toBe('loan-usd');
    });

    it('completedLoans incluye préstamos no activos y sin nextInstallment', async () => {
      prismaMock.client.findFirst.mockResolvedValue({
        ...multiLoanClient,
        loans: [
          { ...multiLoanClient.loans[0], status: 'DEFAULTED' },
          { ...multiLoanClient.loans[0], status: 'REFINANCED' },
        ],
      });

      const result = await service.findOne('user-1', 'client-1');

      expect(result.data.activeLoans).toHaveLength(0);
      expect(result.data.completedLoans).toHaveLength(2);
      expect(result.data.completedLoans[0]).not.toHaveProperty(
        'nextInstallment',
      );
    });

    it('convierte los valores Decimal de los préstamos a number', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');
      const bob = result.data.activeLoans[0];

      expect(bob.capitalAmount).toBe(1000);
      expect(bob.totalAmount).toBe(1300);
      expect(bob.outstandingBalance).toBe(650);
      expect(bob.totalPaid).toBe(650);
      expect(bob.interestRate).toBe(10);
      expect(bob.mode).toBe('automatic');
      expect(bob.periodType).toBe('monthly');
    });

    it('devuelve garantías y convierte latitud/longitud a number', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');

      expect(result.data.client.latitude).toBeCloseTo(-16.5001);
      expect(result.data.client.longitude).toBeCloseTo(-68.1342);
      expect(result.data.guarantees).toHaveLength(1);
      expect(result.data.guarantees[0].estimatedValue).toBe(15000);
      expect(result.data.guarantees[0].status).toBe('IN_USE');
    });

    it('no expone resumen financiero', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');

      expect(result.data).not.toHaveProperty('financialSummary');
    });
  });
});
