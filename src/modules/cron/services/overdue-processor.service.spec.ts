import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { OverdueProcessorService } from './overdue-processor.service';

describe('OverdueProcessorService', () => {
  let service: OverdueProcessorService;

  const mockPrismaService = {
    businessConfig: {
      findMany: jest.fn(),
    },
    installment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((promises) => Promise.all(promises)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverdueProcessorService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OverdueProcessorService>(OverdueProcessorService);
  });

  it('should mark overdue installments and update delinquent clients correctly', async () => {
    // Config: user-1 tiene 0 días de gracia
    mockPrismaService.businessConfig.findMany.mockResolvedValue([
      { userId: 'user-1', graceDays: 0 },
    ]);

    // Cuotas: cuota 1 venció ayer (2026-08-19)
    const referenceDate = new Date('2026-08-20T12:00:00.000Z');
    mockPrismaService.installment.findMany.mockResolvedValue([
      {
        id: 'inst-1',
        installmentNumber: 1,
        dueDate: new Date('2026-08-19T00:00:00.000Z'),
        paidAmount: '0',
        status: 'PENDING',
        daysOverdue: 0,
        loan: {
          id: 'loan-1',
          clientId: 'client-1',
          createdBy: 'user-1',
        },
      },
    ]);

    // Clientes: client-1 está CURRENT pero tiene la cuota vencida del 19 de agosto
    mockPrismaService.client.findMany.mockResolvedValue([
      {
        id: 'client-1',
        userId: 'user-1',
        status: 'CURRENT',
        loans: [
          {
            createdBy: 'user-1',
            installments: [
              {
                dueDate: new Date('2026-08-19T00:00:00.000Z'),
              },
            ],
          },
        ],
      },
    ]);

    mockPrismaService.installment.update.mockResolvedValue({});
    mockPrismaService.client.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processOverdue(referenceDate);

    expect(result.updatedInstallmentsCount).toBe(1);
    expect(result.markedDelinquentClientsCount).toBe(1);
    expect(result.restoredCurrentClientsCount).toBe(0);

    expect(mockPrismaService.installment.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: {
        status: 'OVERDUE',
        daysOverdue: 1,
      },
    });

    expect(mockPrismaService.client.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['client-1'] } },
      data: { status: 'DELINQUENT' },
    });
  });

  it('should restore delinquent client back to CURRENT when no overdue installments remain', async () => {
    mockPrismaService.businessConfig.findMany.mockResolvedValue([
      { userId: 'user-1', graceDays: 0 },
    ]);

    const referenceDate = new Date('2026-08-20T12:00:00.000Z');
    // No hay cuotas pendientes vencidas
    mockPrismaService.installment.findMany.mockResolvedValue([]);

    // Cliente está DELINQUENT pero ya no tiene cuotas vencidas
    mockPrismaService.client.findMany.mockResolvedValue([
      {
        id: 'client-1',
        userId: 'user-1',
        status: 'DELINQUENT',
        loans: [
          {
            createdBy: 'user-1',
            installments: [],
          },
        ],
      },
    ]);

    mockPrismaService.client.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processOverdue(referenceDate);

    expect(result.updatedInstallmentsCount).toBe(0);
    expect(result.markedDelinquentClientsCount).toBe(0);
    expect(result.restoredCurrentClientsCount).toBe(1);

    expect(mockPrismaService.client.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['client-1'] } },
      data: { status: 'CURRENT' },
    });
  });
});
