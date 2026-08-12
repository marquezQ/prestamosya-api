import { Injectable } from '@nestjs/common';
import { PrismaClientLike } from '../../../../common/types/prisma.types';
import { PrismaService } from '../../../../prisma/prisma.service';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import { LoanEntity } from '../../domain/entities/loan.entity';
import { LoanRepository } from '../../domain/repositories/loan.repository';
import { LoanMapper } from '../mappers/loan.mapper';

/**
 * Implementación de LoanRepository usando Prisma.
 */
@Injectable()
export class PrismaLoanRepository extends LoanRepository {
  constructor(private readonly prisma: PrismaService | PrismaClientLike) {
    super();
  }

  async findById(id: string): Promise<LoanEntity | null> {
    const raw = await this.prisma.loan.findUnique({
      where: { id },
    });

    if (!raw) return null;
    return LoanMapper.toDomain(raw);
  }

  async findByIdWithInstallments(id: string): Promise<LoanEntity | null> {
    const raw = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        installments: {
          where: { archived: false },
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    if (!raw) return null;
    return LoanMapper.toDomain(raw);
  }

  async findByClientId(clientId: string): Promise<LoanEntity[]> {
    const loans = await this.prisma.loan.findMany({
      where: { clientId },
      include: {
        installments: {
          where: { archived: false },
          orderBy: { installmentNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return loans.map((loan) => LoanMapper.toDomain(loan));
  }

  async save(
    loan: LoanEntity,
    installments: InstallmentEntity[],
  ): Promise<LoanEntity> {
    const loanData = LoanMapper.toPrismaCreate(loan);

    const createdLoan = await this.prisma.loan.create({
      data: {
        ...loanData,
        installments: {
          create: installments.map((i) => ({
            installmentNumber: i.installmentNumber,
            dueDate: i.dueDate,
            capitalAmount: i.capitalAmount.toString(),
            interestAmount: i.interestAmount.toString(),
            totalAmount: i.totalAmount.toString(),
            paidAmount: i.paidAmount.toString(),
            status: i.status,
            daysOverdue: i.daysOverdue,
            paidAt: i.paidAt,
            archived: i.archived,
          })),
        },
      },
      include: {
        installments: {
          where: { archived: false },
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    return LoanMapper.toDomain(createdLoan);
  }

  async update(loan: LoanEntity): Promise<void> {
    if (!loan.id) return;

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        totalPaid: loan.totalPaid.toString(),
        outstandingBalance: loan.outstandingBalance.toString(),
        status: loan.status,
      },
    });
  }
}
