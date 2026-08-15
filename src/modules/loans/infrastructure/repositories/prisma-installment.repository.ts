import { Injectable } from '@nestjs/common';
import { PrismaClientLike } from '../../../../common/types/prisma.types';
import { InstallmentEntity } from '../../domain/entities/installment.entity';
import { InstallmentRepository } from '../../domain/repositories/installment.repository';
import { InstallmentMapper } from '../mappers/installment.mapper';

/**
 * Implementación de la abstracción InstallmentRepository usando Prisma.
 */
@Injectable()
export class PrismaInstallmentRepository extends InstallmentRepository {
  constructor(private readonly prisma: PrismaClientLike) {
    super();
  }

  async findByLoanId(
    loanId: string,
    onlyActive = true,
  ): Promise<InstallmentEntity[]> {
    const rawInstallments = await this.prisma.installment.findMany({
      where: {
        loanId,
        ...(onlyActive && { archived: false }),
      },
      orderBy: {
        installmentNumber: 'asc',
      },
    });

    return rawInstallments.map((raw) => InstallmentMapper.toDomain(raw));
  }

  async saveMany(
    loanId: string,
    installments: InstallmentEntity[],
  ): Promise<void> {
    const data = installments.map((i) =>
      InstallmentMapper.toPrismaCreate(i, loanId),
    );

    await this.prisma.installment.createMany({
      data,
    });
  }

  async updateMany(installments: InstallmentEntity[]): Promise<void> {
    for (const installment of installments) {
      if (!installment.id) continue;

      await this.prisma.installment.update({
        where: { id: installment.id },
        data: {
          paidAmount: installment.paidAmount.toString(),
          status: installment.status,
          daysOverdue: installment.daysOverdue,
          paidAt: installment.paidAt,
          archived: installment.archived,
        },
      });
    }
  }

  async archiveByLoanId(loanId: string): Promise<void> {
    await this.prisma.installment.updateMany({
      where: { loanId, archived: false },
      data: { archived: true },
    });
  }
}
