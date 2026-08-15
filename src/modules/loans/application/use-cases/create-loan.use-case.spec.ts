import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LoanEntity } from '../../domain/entities/loan.entity';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import { LoanMode, LoanStatus, PeriodType } from '../../domain/enums';
import { InvalidInstallmentsError } from '../../domain/errors/loan-domain.errors';
import { LoanCalculatorService } from '../../domain/services/loan-calculator.service';
import { CreateLoanUseCase } from './create-loan.use-case';
import { UnitOfWork } from '../ports/unit-of-work.port';
import { CreateLoanDto } from '../../dto/create-loan.dto';
import { LoanRepository } from '../../domain/repositories/loan.repository';
import { InstallmentRepository } from '../../domain/repositories/installment.repository';

describe('CreateLoanUseCase', () => {
  let useCase: CreateLoanUseCase;

  const mockPrismaService = {
    client: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLoanRepository = {
    save: jest
      .fn<Promise<LoanEntity>, [LoanEntity, InstallmentEntity[]]>()
      .mockImplementation((loanEntity: LoanEntity) =>
        Promise.resolve(loanEntity),
      ),
  };

  const mockInstallmentRepository = {
    saveMany: jest.fn<Promise<void>, [string, InstallmentEntity[]]>(),
  };

  const mockUnitOfWork = {
    execute: jest
      .fn()
      .mockImplementation(
        <T>(
          work: (repos: {
            loans: LoanRepository;
            installments: InstallmentRepository;
          }) => Promise<T>,
        ): Promise<T> => {
          return work({
            loans: mockLoanRepository as unknown as LoanRepository,
            installments:
              mockInstallmentRepository as unknown as InstallmentRepository,
          });
        },
      ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLoanUseCase,
        LoanCalculatorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UnitOfWork, useValue: mockUnitOfWork },
      ],
    }).compile();

    useCase = module.get<CreateLoanUseCase>(CreateLoanUseCase);
  });

  it('should create an automatic loan successfully', async () => {
    mockPrismaService.client.findFirst.mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      status: 'NO_LOAN',
    });

    const dto: CreateLoanDto = {
      clientId: 'client-1',
      mode: LoanMode.AUTOMATIC,
      capitalAmount: 1000,
      currency: 'BOB',
      interestRate: 10,
      periodType: PeriodType.MONTHLY,
      totalInstallments: 3,
      startDate: '2026-08-15',
      firstDueDate: '2026-09-15',
    };

    const result = await useCase.execute('user-1', dto);

    expect(result).toBeDefined();
    expect(result.status).toBe(LoanStatus.ACTIVE);
    expect(result.capitalAmount.toNumber()).toBe(1000);
    expect(result.totalAmount.toNumber()).toBe(1300);
    expect(result.installments).toHaveLength(3);

    expect(mockPrismaService.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-1', userId: 'user-1', deletedAt: null },
    });
    expect(mockUnitOfWork.execute).toHaveBeenCalled();
    expect(mockLoanRepository.save).toHaveBeenCalled();

    expect(mockPrismaService.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { status: 'CURRENT' },
    });
  });

  it('should throw NotFoundException if client does not exist or belong to user', async () => {
    mockPrismaService.client.findFirst.mockResolvedValue(null);

    const dto: CreateLoanDto = {
      clientId: 'client-999',
      mode: LoanMode.AUTOMATIC,
      capitalAmount: 1000,
      currency: 'BOB',
      interestRate: 10,
      periodType: PeriodType.MONTHLY,
      totalInstallments: 3,
      startDate: '2026-08-15',
      firstDueDate: '2026-09-15',
    };

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if periodType is missing in automatic mode', async () => {
    mockPrismaService.client.findFirst.mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      status: 'CURRENT',
    });

    const dto: CreateLoanDto = {
      clientId: 'client-1',
      mode: LoanMode.AUTOMATIC,
      capitalAmount: 1000,
      currency: 'BOB',
      interestRate: 10,
      totalInstallments: 3,
      startDate: '2026-08-15',
      firstDueDate: '2026-09-15',
    };

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should create a manual loan successfully', async () => {
    mockPrismaService.client.findFirst.mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      status: 'CURRENT',
    });

    const dto: CreateLoanDto = {
      clientId: 'client-1',
      mode: LoanMode.MANUAL,
      capitalAmount: 1000,
      currency: 'BOB',
      interestRate: 0,
      totalInstallments: 2,
      startDate: '2026-08-15',
      firstDueDate: '2026-09-15',
      manualInstallments: [
        {
          installmentNumber: 1,
          dueDate: '2026-09-15',
          capitalAmount: 500,
          interestAmount: 50,
          totalAmount: 550,
        },
        {
          installmentNumber: 2,
          dueDate: '2026-10-15',
          capitalAmount: 500,
          interestAmount: 50,
          totalAmount: 550,
        },
      ],
    };

    const result = await useCase.execute('user-1', dto);

    expect(result).toBeDefined();
    expect(result.totalAmount.toNumber()).toBe(1100);
    expect(result.installments).toHaveLength(2);
    expect(mockLoanRepository.save).toHaveBeenCalled();
  });

  it('should throw InvalidInstallmentsError if manual installments total is less than capital', async () => {
    mockPrismaService.client.findFirst.mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      status: 'CURRENT',
    });

    const dto: CreateLoanDto = {
      clientId: 'client-1',
      mode: LoanMode.MANUAL,
      capitalAmount: 1000,
      currency: 'BOB',
      interestRate: 0,
      totalInstallments: 2,
      startDate: '2026-08-15',
      firstDueDate: '2026-09-15',
      manualInstallments: [
        {
          installmentNumber: 1,
          dueDate: '2026-09-15',
          capitalAmount: 300,
          interestAmount: 0,
          totalAmount: 300,
        },
        {
          installmentNumber: 2,
          dueDate: '2026-10-15',
          capitalAmount: 300,
          interestAmount: 0,
          totalAmount: 300,
        },
      ],
    };

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      InvalidInstallmentsError,
    );
  });
});
