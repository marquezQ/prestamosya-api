import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LinkGuaranteeUseCase } from './link-guarantee.use-case';
import {
  createPrismaMock,
  prismaServiceOf,
  PrismaServiceMock,
} from '../../../../testing/prisma.mock';

describe('LinkGuaranteeUseCase', () => {
  let useCase: LinkGuaranteeUseCase;
  let prismaMock: PrismaServiceMock;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: PrismaServiceMock) => Promise<unknown>) => cb(prismaMock),
    );
    useCase = new LinkGuaranteeUseCase(prismaServiceOf(prismaMock));
  });

  it('should throw NotFoundException if loan does not exist or belong to user', async () => {
    prismaMock.loan.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('u1', 'l1', 'g1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if guarantee belongs to a different client', async () => {
    prismaMock.loan.findFirst.mockResolvedValue({ id: 'l1', clientId: 'c1' });
    prismaMock.guarantee.findFirst.mockResolvedValue({
      id: 'g1',
      clientId: 'c2',
      status: 'AVAILABLE',
    });

    await expect(useCase.execute('u1', 'l1', 'g1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException if guarantee is already IN_USE', async () => {
    prismaMock.loan.findFirst.mockResolvedValue({ id: 'l1', clientId: 'c1' });
    prismaMock.guarantee.findFirst.mockResolvedValue({
      id: 'g1',
      clientId: 'c1',
      status: 'IN_USE',
    });

    await expect(useCase.execute('u1', 'l1', 'g1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should link guarantee successfully when valid', async () => {
    prismaMock.loan.findFirst.mockResolvedValue({ id: 'l1', clientId: 'c1' });
    prismaMock.guarantee.findFirst.mockResolvedValue({
      id: 'g1',
      clientId: 'c1',
      status: 'AVAILABLE',
    });
    prismaMock.loanGuarantee.create.mockResolvedValue({
      id: 'lg1',
      loanId: 'l1',
      guaranteeId: 'g1',
      status: 'ACTIVE',
      guarantee: {
        id: 'g1',
        type: 'VEHICLE',
        description: 'Auto',
        estimatedValue: '5000',
        status: 'IN_USE',
      },
    });

    const res = await useCase.execute('u1', 'l1', 'g1');

    expect(res.id).toBe('lg1');
    expect(res.guarantee.status).toBe('IN_USE');
  });
});
