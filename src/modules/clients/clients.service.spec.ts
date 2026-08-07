import { ConflictException, NotFoundException } from '@nestjs/common';

import { ClientsService } from './clients.service';
import {
  createPrismaMock,
  lastCallArg,
  prismaServiceOf,
} from '../../testing/prisma.mock';

/**
 * Unit tests de ClientsService: se inyecta un mock de Prisma (sin BD) para
 * probar solo la lógica del service. El caso clave es `findOne()`, que agrega
 * el resumen financiero por moneda, mora y siguiente cuota.
 */
describe('ClientsService', () => {
  let service: ClientsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  /** Utilidad: convierte un número en un objeto con `.toString()` (simula Decimal de Prisma). */
  const dec = (n: number) => ({ toString: () => n.toFixed(2) });

  /** Cliente base con dos préstamos (BOB y USD) y una garantía. */
  const multiLoanClient = {
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
        currency: 'BOB',
        totalAmount: dec(1000),
        outstandingBalance: dec(400),
        startDate: new Date('2026-01-03'),
        installments: [
          {
            id: 'inst-1',
            installmentNumber: 1,
            dueDate: new Date('2026-01-10'),
            status: 'PAID',
            totalAmount: dec(433.33),
            paidAmount: dec(433.33),
          },
          {
            id: 'inst-2',
            installmentNumber: 2,
            dueDate: new Date('2026-01-20'),
            status: 'PENDING',
            totalAmount: dec(433.34),
            paidAmount: dec(0),
          },
        ],
      },
      {
        id: 'loan-usd',
        currency: 'USD',
        totalAmount: dec(300),
        outstandingBalance: dec(200),
        startDate: new Date('2026-01-05'),
        installments: [
          {
            id: 'inst-3',
            installmentNumber: 1,
            dueDate: new Date('2026-01-15'),
            status: 'OVERDUE',
            totalAmount: dec(200),
            paidAmount: dec(50),
          },
        ],
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

    it('agrupa el resumen financiero por moneda sin mezclarlas', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');
      const summary = result.data.financialSummary;

      expect(summary).toHaveLength(2);
      const bob = summary.find((s) => s.currency === 'BOB');
      const usd = summary.find((s) => s.currency === 'USD');
      expect(bob).toBeDefined();
      expect(usd).toBeDefined();
      // Sin mezclar: BOB suma solo saldos BOB, USD solo saldos USD.
      expect(bob!.totalOwed).toBe(400);
      expect(usd!.totalOwed).toBe(200);
    });

    it('cuenta cuotas OVERDUE y su monto pendiente por moneda', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');
      const usd = result.data.financialSummary.find(
        (s) => s.currency === 'USD',
      );

      expect(usd!.overdueInstallments).toBe(1);
      // Pendiente = totalAmount - paidAmount = 200 - 50
      expect(usd!.overdueAmount).toBe(150);
    });

    it('devuelve la siguiente cuota no pagada con su monto pendiente', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');
      const bobLoan = result.data.activeLoans.find((l) => l.currency === 'BOB');

      expect(bobLoan!.nextInstallment!.number).toBe(2);
      // Pendiente = totalAmount - paidAmount = 433.34 - 0
      expect(bobLoan!.nextInstallment!.pendingAmount).toBeCloseTo(433.34);
    });

    it('convierte latitud/longitud y valores Decimal a number', async () => {
      prismaMock.client.findFirst.mockResolvedValue(multiLoanClient);

      const result = await service.findOne('user-1', 'client-1');

      expect(result.data.client.latitude).toBeCloseTo(-16.5001);
      expect(result.data.client.longitude).toBeCloseTo(-68.1342);
    });
  });
});
