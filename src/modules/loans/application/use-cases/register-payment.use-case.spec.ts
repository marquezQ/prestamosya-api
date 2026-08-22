import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import { LoanEntity } from '../../domain/entities/loan.entity';
import {
  InstallmentStatus,
  LoanMode,
  LoanStatus,
  PeriodType,
} from '../../domain/enums';
import {
  LoanNotActiveError,
  PaymentExceedsBalanceError,
} from '../../domain/errors/loan-domain.errors';
import { InstallmentRepository } from '../../domain/repositories/installment.repository';
import { LoanRepository } from '../../domain/repositories/loan.repository';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { Money } from '../../domain/value-objects/money.vo';
import { UnitOfWork } from '../ports/unit-of-work.port';
import {
  RegisterPaymentInput,
  RegisterPaymentUseCase,
} from './register-payment.use-case';

function createMockLoan(
  overrides: Partial<{
    outstandingBalance: number;
    totalPaid: number;
    status: LoanStatus;
  }> = {},
): LoanEntity {
  const currency = 'BOB';
  const inst1 = new InstallmentEntity(
    'inst-1',
    'loan-1',
    1,
    new Date('2026-08-01'),
    Money.of(300, currency),
    Money.of(100, currency),
    Money.of(400, currency),
    Money.zero(currency),
    InstallmentStatus.PENDING,
    0,
    null,
    false,
  );

  const inst2 = new InstallmentEntity(
    'inst-2',
    'loan-1',
    2,
    new Date('2026-09-01'),
    Money.of(300, currency),
    Money.of(100, currency),
    Money.of(400, currency),
    Money.zero(currency),
    InstallmentStatus.PENDING,
    0,
    null,
    false,
  );

  return new LoanEntity(
    'loan-1',
    'client-1',
    'user-1',
    LoanMode.AUTOMATIC,
    Money.of(600, currency),
    new Decimal('10'),
    PeriodType.MONTHLY,
    2,
    Money.of(800, currency),
    Money.of(overrides.totalPaid ?? 0, currency),
    Money.of(overrides.outstandingBalance ?? 800, currency),
    overrides.status ?? LoanStatus.ACTIVE,
    new Date('2026-07-01'),
    new Date('2026-08-01'),
    null,
    [inst1, inst2],
  );
}

describe('RegisterPaymentUseCase', () => {
  let useCase: RegisterPaymentUseCase;

  const mockPrismaService = {
    loan: {
      findFirst: jest.fn(),
    },
  };

  const mockLoanRepository = {
    findByIdWithPendingInstallments: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockInstallmentRepository = {
    updateMany: jest.fn().mockResolvedValue(undefined),
  };

  const mockPaymentRepository = {
    create: jest.fn().mockResolvedValue('payment-1'),
  };

  const mockUnitOfWork = {
    execute: jest
      .fn()
      .mockImplementation(
        <T>(
          work: (repos: {
            loans: LoanRepository;
            installments: InstallmentRepository;
            payments: PaymentRepository;
          }) => Promise<T>,
        ): Promise<T> => {
          return work({
            loans: mockLoanRepository as unknown as LoanRepository,
            installments:
              mockInstallmentRepository as unknown as InstallmentRepository,
            payments: mockPaymentRepository as unknown as PaymentRepository,
          });
        },
      ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterPaymentUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UnitOfWork, useValue: mockUnitOfWork },
      ],
    }).compile();

    useCase = module.get<RegisterPaymentUseCase>(RegisterPaymentUseCase);
  });

  it('should register payment and apply FIFO distribution correctly', async () => {
    const loan = createMockLoan();
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const input: RegisterPaymentInput = {
      loanId: 'loan-1',
      amount: 500,
      method: 'cash',
      paymentDate: '2026-08-19',
      notes: 'Pago parcial cuota 2',
    };

    const result = await useCase.execute('user-1', input);

    expect(result.paymentId).toBe('payment-1');
    expect(result.amount).toBe(500);
    expect(result.outstandingBalance).toBe(300);
    expect(result.affectedInstallments).toHaveLength(2);

    expect(result.affectedInstallments[0]).toEqual({
      installmentId: 'inst-1',
      installmentNumber: 1,
      amountApplied: 400,
      newStatus: InstallmentStatus.PAID,
      remainingAmount: 0,
    });

    expect(result.affectedInstallments[1]).toEqual({
      installmentId: 'inst-2',
      installmentNumber: 2,
      amountApplied: 100,
      newStatus: InstallmentStatus.PARTIAL,
      remainingAmount: 300,
    });

    expect(mockPaymentRepository.create).toHaveBeenCalledWith({
      loanId: 'loan-1',
      registeredBy: 'user-1',
      amount: '500.00',
      paymentDate: new Date('2026-08-19'),
      method: 'cash',
      notes: 'Pago parcial cuota 2',
      installmentLinks: [
        { installmentId: 'inst-1', amountApplied: '400.00' },
        { installmentId: 'inst-2', amountApplied: '100.00' },
      ],
    });

    expect(mockInstallmentRepository.updateMany).toHaveBeenCalled();
    expect(mockLoanRepository.update).toHaveBeenCalled();
  });

  it('should complete loan when full balance is paid', async () => {
    const loan = createMockLoan();
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const input: RegisterPaymentInput = {
      loanId: 'loan-1',
      amount: 800,
      method: 'transfer',
      paymentDate: '2026-08-19',
    };

    const result = await useCase.execute('user-1', input);

    expect(result.loanStatus).toBe(LoanStatus.COMPLETED);
    expect(result.outstandingBalance).toBe(0);
    expect(result.affectedInstallments).toHaveLength(2);
    expect(result.affectedInstallments[0].newStatus).toBe(
      InstallmentStatus.PAID,
    );
    expect(result.affectedInstallments[1].newStatus).toBe(
      InstallmentStatus.PAID,
    );
  });

  it('should throw NotFoundException if loan does not exist or does not belong to user', async () => {
    mockPrismaService.loan.findFirst.mockResolvedValue(null);

    const input: RegisterPaymentInput = {
      loanId: 'loan-unknown',
      amount: 100,
      method: 'cash',
      paymentDate: '2026-08-19',
    };

    await expect(useCase.execute('user-1', input)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw PaymentExceedsBalanceError if payment exceeds outstanding balance', async () => {
    const loan = createMockLoan();
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const input: RegisterPaymentInput = {
      loanId: 'loan-1',
      amount: 900,
      method: 'cash',
      paymentDate: '2026-08-19',
    };

    await expect(useCase.execute('user-1', input)).rejects.toThrow(
      PaymentExceedsBalanceError,
    );
  });

  it('should throw LoanNotActiveError if loan is not active', async () => {
    const loan = createMockLoan({
      status: LoanStatus.COMPLETED,
      outstandingBalance: 0,
    });
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const input: RegisterPaymentInput = {
      loanId: 'loan-1',
      amount: 100,
      method: 'cash',
      paymentDate: '2026-08-19',
    };

    await expect(useCase.execute('user-1', input)).rejects.toThrow(
      LoanNotActiveError,
    );
  });
});
