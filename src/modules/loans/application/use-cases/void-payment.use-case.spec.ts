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
  PaymentAlreadyVoidedError,
  PaymentNotFoundError,
} from '../../domain/errors/loan-domain.errors';
import { InstallmentRepository } from '../../domain/repositories/installment.repository';
import { LoanRepository } from '../../domain/repositories/loan.repository';
import {
  PaymentRecord,
  PaymentRepository,
} from '../../domain/repositories/payment.repository';
import { Money } from '../../domain/value-objects/money.vo';
import { UnitOfWork } from '../ports/unit-of-work.port';
import { VoidPaymentUseCase } from './void-payment.use-case';

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
    Money.of(400, currency),
    InstallmentStatus.PAID,
    0,
    new Date('2026-08-01'),
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
    Money.of(100, currency),
    InstallmentStatus.PARTIAL,
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
    Money.of(overrides.totalPaid ?? 500, currency),
    Money.of(overrides.outstandingBalance ?? 300, currency),
    overrides.status ?? LoanStatus.ACTIVE,
    new Date('2026-07-01'),
    new Date('2026-08-01'),
    null,
    [inst1, inst2],
  );
}

function createMockPaymentRecord(
  overrides: Partial<PaymentRecord> = {},
): PaymentRecord {
  return {
    id: 'payment-1',
    loanId: 'loan-1',
    registeredBy: 'user-1',
    amount: '500.00',
    discountAmount: '0.00',
    paymentDate: new Date('2026-08-19'),
    method: 'cash',
    notes: 'Pago parcial',
    voided: false,
    voidedAt: null,
    voidReason: null,
    createdAt: new Date('2026-08-19'),
    installmentLinks: [
      {
        id: 'link-1',
        installmentId: 'inst-1',
        amountApplied: '400.00',
        discountApplied: '0.00',
      },
      {
        id: 'link-2',
        installmentId: 'inst-2',
        amountApplied: '100.00',
        discountApplied: '0.00',
      },
    ],
    ...overrides,
  };
}

describe('VoidPaymentUseCase', () => {
  let useCase: VoidPaymentUseCase;

  const mockPrismaService = {
    loan: {
      findFirst: jest.fn(),
    },
  };

  const mockLoanRepository = {
    findByIdWithInstallments: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockInstallmentRepository = {
    updateMany: jest.fn().mockResolvedValue(undefined),
  };

  const mockPaymentRepository = {
    findById: jest.fn(),
    markVoided: jest.fn().mockResolvedValue(undefined),
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
        VoidPaymentUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UnitOfWork, useValue: mockUnitOfWork },
      ],
    }).compile();

    useCase = module.get<VoidPaymentUseCase>(VoidPaymentUseCase);
  });

  it('should void a payment and restore loan and installment states', async () => {
    const payment = createMockPaymentRecord();
    const loan = createMockLoan();

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    mockLoanRepository.findByIdWithInstallments.mockResolvedValue(loan);

    await useCase.execute('user-1', 'payment-1', 'Error en cobro');

    expect(loan.outstandingBalance.toNumber()).toBe(800);
    expect(loan.totalPaid.toNumber()).toBe(0);
    expect(loan.installments[0].paidAmount.toNumber()).toBe(0);
    expect(loan.installments[0].status).toBe(InstallmentStatus.PENDING);
    expect(loan.installments[1].paidAmount.toNumber()).toBe(0);
    expect(loan.installments[1].status).toBe(InstallmentStatus.PENDING);

    expect(mockPaymentRepository.markVoided).toHaveBeenCalledWith(
      'payment-1',
      'Error en cobro',
    );
    expect(mockInstallmentRepository.updateMany).toHaveBeenCalled();
    expect(mockLoanRepository.update).toHaveBeenCalledWith(loan);
  });

  it('should reactivate loan if it was COMPLETED prior to voiding', async () => {
    const payment = createMockPaymentRecord({ amount: '800.00' });
    const loan = createMockLoan({
      status: LoanStatus.COMPLETED,
      outstandingBalance: 0,
      totalPaid: 800,
    });

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    mockLoanRepository.findByIdWithInstallments.mockResolvedValue(loan);

    await useCase.execute('user-1', 'payment-1', 'Reversión completa');

    expect(loan.status).toBe(LoanStatus.ACTIVE);
    expect(loan.outstandingBalance.toNumber()).toBe(800);
  });

  it('should throw PaymentNotFoundError if payment does not exist', async () => {
    mockPaymentRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'payment-invalid', 'Motivo'),
    ).rejects.toThrow(PaymentNotFoundError);
  });

  it('should throw PaymentAlreadyVoidedError if payment is already voided', async () => {
    const payment = createMockPaymentRecord({ voided: true });
    mockPaymentRepository.findById.mockResolvedValue(payment);

    await expect(
      useCase.execute('user-1', 'payment-1', 'Motivo'),
    ).rejects.toThrow(PaymentAlreadyVoidedError);
  });

  it('should throw NotFoundException if loan does not belong to user', async () => {
    const payment = createMockPaymentRecord();
    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockPrismaService.loan.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'payment-1', 'Motivo'),
    ).rejects.toThrow(NotFoundException);
  });
});
