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
  SettlementDoesNotClearBalanceError,
  SettlementExceedsBalanceError,
} from '../../domain/errors/loan-domain.errors';
import { InstallmentRepository } from '../../domain/repositories/installment.repository';
import { LoanRepository } from '../../domain/repositories/loan.repository';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { Money } from '../../domain/value-objects/money.vo';
import { UnitOfWork } from '../ports/unit-of-work.port';
import { SettleLoanInput, SettleLoanUseCase } from './settle-loan.use-case';

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

describe('SettleLoanUseCase', () => {
  let useCase: SettleLoanUseCase;

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
    create: jest.fn().mockResolvedValue('payment-settle-1'),
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
        SettleLoanUseCase,
        { provide: UnitOfWork, useValue: mockUnitOfWork },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<SettleLoanUseCase>(SettleLoanUseCase);
  });

  const validSettleInput: SettleLoanInput = {
    loanId: 'loan-1',
    amount: 700,
    discount: 100,
    method: 'cash',
    paymentDate: '2026-08-15',
    notes: 'Liquidación anticipada con descuento de 100 BOB',
  };

  it('should successfully settle a loan with early discount', async () => {
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    const loan = createMockLoan({ outstandingBalance: 800 });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const result = await useCase.execute('user-1', validSettleInput);

    expect(result.paymentId).toBe('payment-settle-1');
    expect(result.amount).toBe(700);
    expect(result.discountAmount).toBe(100);
    expect(result.loanStatus).toBe(LoanStatus.COMPLETED);
    expect(result.outstandingBalance).toBe(0);

    // Invariante crítico: totalAmount sigue siendo 800 (no cambia)
    expect(loan.totalAmount.toNumber()).toBe(800);
    // totalPaid sólo incrementa en el dinero físico real (700)
    expect(loan.totalPaid.toNumber()).toBe(700);

    // El pago guardado en el repo debe recibir el discountAmount = 100
    expect(mockPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        loanId: 'loan-1',
        amount: '700.00',
        discountAmount: '100.00',
      }),
    );

    // Ambas cuotas deben quedar PAID
    expect(loan.installments[0].isPaid).toBe(true);
    expect(loan.installments[1].isPaid).toBe(true);
  });

  it('should successfully settle a loan without discount (discount = 0)', async () => {
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    const loan = createMockLoan({ outstandingBalance: 800 });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const inputNoDiscount: SettleLoanInput = {
      ...validSettleInput,
      amount: 800,
      discount: 0,
    };

    const result = await useCase.execute('user-1', inputNoDiscount);

    expect(result.loanStatus).toBe(LoanStatus.COMPLETED);
    expect(result.outstandingBalance).toBe(0);
    expect(loan.totalPaid.toNumber()).toBe(800);
    expect(mockPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '800.00',
        discountAmount: '0.00',
      }),
    );
  });

  it('should throw NotFoundException if loan does not exist or user is not owner', async () => {
    mockPrismaService.loan.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('user-1', validSettleInput)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw SettlementExceedsBalanceError if amount + discount > outstandingBalance', async () => {
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    const loan = createMockLoan({ outstandingBalance: 800 });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const invalidInput: SettleLoanInput = {
      ...validSettleInput,
      amount: 800,
      discount: 100, // Suma 900 > 800
    };

    await expect(useCase.execute('user-1', invalidInput)).rejects.toThrow(
      SettlementExceedsBalanceError,
    );
  });

  it('should throw SettlementDoesNotClearBalanceError if amount + discount < outstandingBalance', async () => {
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    const loan = createMockLoan({ outstandingBalance: 800 });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    const partialInput: SettleLoanInput = {
      ...validSettleInput,
      amount: 500,
      discount: 100, // Suma 600 < 800 (no liquida el préstamo por completo)
    };

    await expect(useCase.execute('user-1', partialInput)).rejects.toThrow(
      SettlementDoesNotClearBalanceError,
    );
  });

  it('should throw LoanNotActiveError if loan is not active', async () => {
    mockPrismaService.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    const loan = createMockLoan({
      outstandingBalance: 0,
      status: LoanStatus.COMPLETED,
    });
    mockLoanRepository.findByIdWithPendingInstallments.mockResolvedValue(loan);

    await expect(useCase.execute('user-1', validSettleInput)).rejects.toThrow(
      LoanNotActiveError,
    );
  });
});
