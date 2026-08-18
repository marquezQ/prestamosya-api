import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GuaranteesService } from './guarantees.service';
import {
  createPrismaMock,
  prismaServiceOf,
  PrismaServiceMock,
} from '../../testing/prisma.mock';
import { GuaranteeType } from '../../generated/prisma/client';

describe('GuaranteesService', () => {
  let service: GuaranteesService;
  let prismaMock: PrismaServiceMock;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    service = new GuaranteesService(prismaServiceOf(prismaMock));
  });

  describe('create', () => {
    it('should create a guarantee successfully if client belongs to user', async () => {
      prismaMock.client.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
      prismaMock.guarantee.create.mockResolvedValue({
        id: 'g1',
        clientId: 'c1',
        type: 'VEHICLE',
        description: 'Moto',
        estimatedValue: '1500',
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.create('u1', {
        clientId: 'c1',
        type: GuaranteeType.VEHICLE,
        description: 'Moto',
        estimatedValue: 1500,
      });

      expect(res.id).toBe('g1');
      expect(res.estimatedValue).toBe(1500);
    });

    it('should throw NotFoundException if client does not belong to user', async () => {
      prismaMock.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create('u1', {
          clientId: 'c1',
          type: GuaranteeType.VEHICLE,
          description: 'Moto',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException if guarantee is IN_USE', async () => {
      prismaMock.guarantee.findFirst.mockResolvedValue({
        id: 'g1',
        status: 'IN_USE',
      });

      await expect(service.remove('u1', 'g1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should soft delete if guarantee is AVAILABLE', async () => {
      prismaMock.guarantee.findFirst.mockResolvedValue({
        id: 'g1',
        status: 'AVAILABLE',
      });
      prismaMock.guarantee.update.mockResolvedValue({});

      const res = await service.remove('u1', 'g1');
      expect(res.message).toBe('Guarantee deleted successfully');
    });
  });
});
