import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
import { InvalidInstallmentsError } from '../../domain/errors/loan-domain.errors';
import { LoanCalculatorService } from '../../domain/services/loan-calculator.service';
import { Money } from '../../domain/value-objects/money.vo';
import { UnitOfWork } from '../ports/unit-of-work.port';
import { CreateLoanDto } from '../../dto/create-loan.dto';

@Injectable()
export class CreateLoanUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly calculator: LoanCalculatorService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(userId: string, dto: CreateLoanDto): Promise<LoanEntity> {
    // 1. Validar que el cliente existe y pertenece al usuario autenticado
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const currency = dto.currency;
    const capital = Money.of(dto.capitalAmount, currency);
    const interestRate = new Decimal(dto.interestRate);
    const startDate = new Date(dto.startDate);
    const firstDueDate = new Date(dto.firstDueDate);

    let installments: InstallmentEntity[];
    let totalAmount: Money;

    if (dto.mode === LoanMode.AUTOMATIC) {
      if (!dto.periodType) {
        throw new BadRequestException(
          'periodType is required for automatic loan mode',
        );
      }

      const result = this.calculator.calculateInstallments({
        capital,
        interestRate,
        totalInstallments: dto.totalInstallments,
        firstDueDate,
        periodType: dto.periodType,
      });

      installments = result.installments;
      totalAmount = result.totalAmount;
    } else {
      // Modo MANUAL
      if (!dto.manualInstallments || dto.manualInstallments.length === 0) {
        throw new BadRequestException(
          'manualInstallments list is required for manual loan mode',
        );
      }

      if (dto.manualInstallments.length !== dto.totalInstallments) {
        throw new BadRequestException(
          `manualInstallments length (${dto.manualInstallments.length}) does not match totalInstallments (${dto.totalInstallments})`,
        );
      }

      installments = dto.manualInstallments.map((mi) => {
        return new InstallmentEntity(
          null,
          null,
          mi.installmentNumber,
          new Date(mi.dueDate),
          Money.of(mi.capitalAmount, currency),
          Money.of(mi.interestAmount, currency),
          Money.of(mi.totalAmount, currency),
          Money.zero(currency),
          InstallmentStatus.PENDING,
          0,
          null,
          false,
        );
      });

      // Sumar el total de las cuotas manuales
      totalAmount = installments.reduce(
        (acc, inst) => acc.add(inst.totalAmount),
        Money.zero(currency),
      );

      if (totalAmount.isLessThan(capital)) {
        throw new InvalidInstallmentsError(
          'Total of manual installments cannot be less than the capital amount',
        );
      }
    }

    // 2. Construir la entidad LoanEntity en estado ACTIVE
    const loanEntity = new LoanEntity(
      null, // id (asignado por BD)
      dto.clientId,
      userId,
      dto.mode,
      capital,
      interestRate,
      dto.periodType ?? PeriodType.CUSTOM,
      dto.totalInstallments,
      totalAmount,
      Money.zero(currency), // totalPaid
      totalAmount, // outstandingBalance
      LoanStatus.ACTIVE,
      startDate,
      firstDueDate,
      dto.notes ?? null,
      installments,
    );

    // 3. Persistir atómicamente con UnitOfWork
    return this.unitOfWork.execute(async (repos) => {
      const createdLoan = await repos.loans.save(loanEntity, installments);

      // Si el cliente no tenía préstamos (NO_LOAN), actualizar a CURRENT
      if (client.status === 'NO_LOAN') {
        await this.prisma.client.update({
          where: { id: client.id },
          data: { status: 'CURRENT' },
        });
      }

      return createdLoan;
    });
  }
}
