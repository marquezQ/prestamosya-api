import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GetHomeDashboardUseCase } from './get-home-dashboard.use-case';

describe('GetHomeDashboardUseCase', () => {
  let useCase: GetHomeDashboardUseCase;

  const mockPrismaService = {
    loan: {
      findMany: jest.fn(),
    },
    client: {
      count: jest.fn(),
    },
    installment: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetHomeDashboardUseCase,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    useCase = module.get<GetHomeDashboardUseCase>(GetHomeDashboardUseCase);
    jest.clearAllMocks();
  });

  it('should calculate capital en calle, loan metrics, client metrics and overdue installments correctly', async () => {
    const userId = 'user-123';

    // Mock préstamos activos
    mockPrismaService.loan.findMany.mockResolvedValue([
      {
        id: 'loan-1',
        currency: 'BOB',
        clientId: 'client-1',
        installments: [
          {
            id: 'inst-1',
            installmentNumber: 1,
            dueDate: new Date('2026-08-01'),
            capitalAmount: 500,
            interestAmount: 100,
            totalAmount: 600,
            paidAmount: 600,
            status: 'PAID',
            daysOverdue: 0,
          },
          {
            id: 'inst-2',
            installmentNumber: 2,
            dueDate: new Date('2026-08-15'),
            capitalAmount: 500,
            interestAmount: 100,
            totalAmount: 600,
            paidAmount: 0,
            status: 'OVERDUE',
            daysOverdue: 10,
          },
        ],
      },
      {
        id: 'loan-2',
        currency: 'USD',
        clientId: 'client-2',
        installments: [
          {
            id: 'inst-3',
            installmentNumber: 1,
            dueDate: new Date('2026-09-10'),
            capitalAmount: 1000,
            interestAmount: 50,
            totalAmount: 1050,
            paidAmount: 0,
            status: 'PENDING',
            daysOverdue: 0,
          },
        ],
      },
    ]);

    mockPrismaService.client.count.mockResolvedValue(5);

    mockPrismaService.installment.findMany.mockResolvedValue([
      {
        id: 'inst-2',
        installmentNumber: 2,
        totalAmount: 600,
        paidAmount: 0,
        status: 'OVERDUE',
        dueDate: new Date('2026-08-15'),
        daysOverdue: 10,
        loan: {
          id: 'loan-1',
          currency: 'BOB',
          client: {
            id: 'client-1',
            fullName: 'Carlos Mendoza',
            phone: '+59171234567',
          },
        },
      },
    ]);

    const result = await useCase.execute(userId);

    // Capital en calle: inst-2 capital 500 en BOB; inst-3 capital 1000 en USD
    expect(result.capitalEnCalle.BOB).toBe(500);
    expect(result.capitalEnCalle.USD).toBe(1000);

    // Préstamos: 2 activos, 1 moroso (loan-1), 1 al día (loan-2)
    expect(result.loansSummary.totalActive).toBe(2);
    expect(result.loansSummary.totalDelinquent).toBe(1);
    expect(result.loansSummary.totalUpToDate).toBe(1);
    expect(result.loansSummary.delinquencyRate).toBe(50);

    // Clientes: 5 total, 1 moroso (client-1), 1 al día (client-2), 3 sin préstamo
    expect(result.clientsSummary.totalClients).toBe(5);
    expect(result.clientsSummary.delinquentClients).toBe(1);
    expect(result.clientsSummary.currentClients).toBe(1);
    expect(result.clientsSummary.noLoanClients).toBe(3);

    // Cuotas vencidas
    expect(result.overdueInstallments).toHaveLength(1);
    expect(result.overdueInstallments[0].installmentId).toBe('inst-2');
    expect(result.overdueInstallments[0].client.firstName).toBe('Carlos');
    expect(result.overdueInstallments[0].client.lastName).toBe('Mendoza');
  });
});
