import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../prisma/prisma.service';
import { lastCallArg } from '../../../../testing/prisma.mock';
import { ListLoansUseCase } from './list-loans.use-case';
import { LoanFilterScope } from '../../dto/list-loans.query.dto';

describe('ListLoansUseCase', () => {
  let useCase: ListLoansUseCase;

  const mockPrismaService = {
    businessConfig: {
      findUnique: jest.fn(),
    },
    loan: {
      findMany: jest.fn(),
    },
  };

  const dec = (val: number) => ({ toString: () => val.toFixed(2) });

  const mockClient = {
    id: 'client-1',
    fullName: 'Juan Pérez',
    idNumber: '1234567 LP',
    phone: '70012345',
    photoUrl: 'https://cloudinary.com/photo.webp',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListLoansUseCase,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    useCase = module.get<ListLoansUseCase>(ListLoansUseCase);
    jest.clearAllMocks();
  });

  it('debe listar préstamos activos (al día y en mora) por defecto', async () => {
    mockPrismaService.businessConfig.findUnique.mockResolvedValue({
      graceDays: 0,
    });

    // Préstamo 1: al día (cuota futura)
    const loanUpToDate = {
      id: 'loan-1',
      currency: 'BOB',
      mode: 'automatic',
      scheduleType: 'EQUAL_INSTALLMENTS',
      capitalAmount: dec(1000),
      interestRate: dec(10),
      periodType: 'monthly',
      totalInstallments: 2,
      totalAmount: dec(1200),
      totalPaid: dec(600),
      outstandingBalance: dec(600),
      status: 'ACTIVE',
      startDate: new Date('2026-08-01'),
      createdAt: new Date('2026-08-01'),
      client: mockClient,
      installments: [
        {
          id: 'inst-1',
          installmentNumber: 1,
          dueDate: new Date('2026-09-01'),
          status: 'PAID',
          paidAmount: dec(600),
          totalAmount: dec(600),
        },
        {
          id: 'inst-2',
          installmentNumber: 2,
          dueDate: new Date('2030-01-01'), // Fecha muy futura -> no vencida
          status: 'PENDING',
          paidAmount: dec(0),
          totalAmount: dec(600),
        },
      ],
    };

    // Préstamo 2: en mora (cuota en OVERDUE)
    const loanOverdue = {
      id: 'loan-2',
      currency: 'BOB',
      mode: 'automatic',
      scheduleType: 'EQUAL_INSTALLMENTS',
      capitalAmount: dec(500),
      interestRate: dec(10),
      periodType: 'monthly',
      totalInstallments: 1,
      totalAmount: dec(550),
      totalPaid: dec(0),
      outstandingBalance: dec(550),
      status: 'ACTIVE',
      startDate: new Date('2026-07-01'),
      createdAt: new Date('2026-07-01'),
      client: mockClient,
      installments: [
        {
          id: 'inst-3',
          installmentNumber: 1,
          dueDate: new Date('2026-07-15'),
          status: 'OVERDUE',
          paidAmount: dec(0),
          totalAmount: dec(550),
        },
      ],
    };

    mockPrismaService.loan.findMany.mockResolvedValue([
      loanUpToDate,
      loanOverdue,
    ]);

    const result = await useCase.execute('user-1', {});

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('loan-1');
    expect(result[0].isDelinquent).toBe(false);
    expect(result[0].paidInstallments).toBe(1);
    expect(result[0].overdueInstallmentsCount).toBe(0);
    expect(result[0].nextDueDate).toBe('2030-01-01');

    expect(result[1].id).toBe('loan-2');
    expect(result[1].isDelinquent).toBe(true);
    expect(result[1].paidInstallments).toBe(0);
    expect(result[1].overdueInstallmentsCount).toBe(1);
  });

  it('debe filtrar solo préstamos al día cuando filter es UP_TO_DATE', async () => {
    mockPrismaService.businessConfig.findUnique.mockResolvedValue({
      graceDays: 0,
    });

    const loanUpToDate = {
      id: 'loan-1',
      currency: 'BOB',
      mode: 'automatic',
      scheduleType: 'EQUAL_INSTALLMENTS',
      capitalAmount: dec(1000),
      interestRate: dec(10),
      periodType: 'monthly',
      totalInstallments: 1,
      totalAmount: dec(1100),
      totalPaid: dec(0),
      outstandingBalance: dec(1100),
      status: 'ACTIVE',
      startDate: new Date('2026-08-01'),
      createdAt: new Date('2026-08-01'),
      client: mockClient,
      installments: [
        {
          id: 'inst-1',
          installmentNumber: 1,
          dueDate: new Date('2030-01-01'),
          status: 'PENDING',
          paidAmount: dec(0),
          totalAmount: dec(1100),
        },
      ],
    };

    const loanOverdue = {
      id: 'loan-2',
      currency: 'BOB',
      mode: 'automatic',
      scheduleType: 'EQUAL_INSTALLMENTS',
      capitalAmount: dec(500),
      interestRate: dec(10),
      periodType: 'monthly',
      totalInstallments: 1,
      totalAmount: dec(550),
      totalPaid: dec(0),
      outstandingBalance: dec(550),
      status: 'ACTIVE',
      startDate: new Date('2026-07-01'),
      createdAt: new Date('2026-07-01'),
      client: mockClient,
      installments: [
        {
          id: 'inst-2',
          installmentNumber: 1,
          dueDate: new Date('2026-07-15'),
          status: 'OVERDUE',
          paidAmount: dec(0),
          totalAmount: dec(550),
        },
      ],
    };

    mockPrismaService.loan.findMany.mockResolvedValue([
      loanUpToDate,
      loanOverdue,
    ]);

    const result = await useCase.execute('user-1', {
      filter: LoanFilterScope.UP_TO_DATE,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('loan-1');
    expect(result[0].isDelinquent).toBe(false);
  });

  it('debe filtrar solo préstamos en mora cuando filter es OVERDUE', async () => {
    mockPrismaService.businessConfig.findUnique.mockResolvedValue({
      graceDays: 0,
    });

    const loanUpToDate = {
      id: 'loan-1',
      currency: 'BOB',
      mode: 'automatic',
      scheduleType: 'EQUAL_INSTALLMENTS',
      capitalAmount: dec(1000),
      interestRate: dec(10),
      periodType: 'monthly',
      totalInstallments: 1,
      totalAmount: dec(1100),
      totalPaid: dec(0),
      outstandingBalance: dec(1100),
      status: 'ACTIVE',
      startDate: new Date('2026-08-01'),
      createdAt: new Date('2026-08-01'),
      client: mockClient,
      installments: [
        {
          id: 'inst-1',
          installmentNumber: 1,
          dueDate: new Date('2030-01-01'),
          status: 'PENDING',
          paidAmount: dec(0),
          totalAmount: dec(1100),
        },
      ],
    };

    const loanOverdue = {
      id: 'loan-2',
      currency: 'BOB',
      mode: 'automatic',
      scheduleType: 'EQUAL_INSTALLMENTS',
      capitalAmount: dec(500),
      interestRate: dec(10),
      periodType: 'monthly',
      totalInstallments: 1,
      totalAmount: dec(550),
      totalPaid: dec(0),
      outstandingBalance: dec(550),
      status: 'ACTIVE',
      startDate: new Date('2026-07-01'),
      createdAt: new Date('2026-07-01'),
      client: mockClient,
      installments: [
        {
          id: 'inst-2',
          installmentNumber: 1,
          dueDate: new Date('2026-07-15'),
          status: 'OVERDUE',
          paidAmount: dec(0),
          totalAmount: dec(550),
        },
      ],
    };

    mockPrismaService.loan.findMany.mockResolvedValue([
      loanUpToDate,
      loanOverdue,
    ]);

    const result = await useCase.execute('user-1', {
      filter: LoanFilterScope.OVERDUE,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('loan-2');
    expect(result[0].isDelinquent).toBe(true);
  });

  it('debe filtrar préstamos completados cuando filter es COMPLETED', async () => {
    mockPrismaService.businessConfig.findUnique.mockResolvedValue({
      graceDays: 0,
    });

    const completedLoan = {
      id: 'loan-completed',
      currency: 'BOB',
      mode: 'automatic',
      scheduleType: 'EQUAL_INSTALLMENTS',
      capitalAmount: dec(1000),
      interestRate: dec(10),
      periodType: 'monthly',
      totalInstallments: 1,
      totalAmount: dec(1100),
      totalPaid: dec(1100),
      outstandingBalance: dec(0),
      status: 'COMPLETED',
      startDate: new Date('2026-06-01'),
      createdAt: new Date('2026-06-01'),
      client: mockClient,
      installments: [
        {
          id: 'inst-1',
          installmentNumber: 1,
          dueDate: new Date('2026-07-01'),
          status: 'PAID',
          paidAmount: dec(1100),
          totalAmount: dec(1100),
        },
      ],
    };

    mockPrismaService.loan.findMany.mockResolvedValue([completedLoan]);

    const result = await useCase.execute('user-1', {
      filter: LoanFilterScope.COMPLETED,
    });

    const callArgs = lastCallArg<{ where: { status?: string } }>(
      mockPrismaService.loan.findMany,
    );
    expect(callArgs.where.status).toBe('COMPLETED');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('loan-completed');
    expect(result[0].status).toBe('COMPLETED');
    expect(result[0].outstandingBalance).toBe(0);
  });

  it('debe aplicar filtro de búsqueda en nombre o carnet del cliente', async () => {
    mockPrismaService.businessConfig.findUnique.mockResolvedValue({
      graceDays: 0,
    });
    mockPrismaService.loan.findMany.mockResolvedValue([]);

    await useCase.execute('user-1', {
      search: 'Pérez',
    });

    const callArgs = lastCallArg<{
      where: {
        client: {
          deletedAt: null;
          OR?: Array<{
            fullName?: { contains: string; mode: string };
            idNumber?: { contains: string; mode: string };
          }>;
        };
      };
    }>(mockPrismaService.loan.findMany);
    expect(callArgs.where.client.deletedAt).toBeNull();
    expect(callArgs.where.client.OR).toEqual([
      { fullName: { contains: 'Pérez', mode: 'insensitive' } },
      { idNumber: { contains: 'Pérez', mode: 'insensitive' } },
    ]);
  });
});
