import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoanRepository } from '../domain/repositories/loan.repository';
import { InstallmentRepository } from '../domain/repositories/installment.repository';
import { UnitOfWork } from '../application/ports/unit-of-work.port';
import { PrismaLoanRepository } from './repositories/prisma-loan.repository';
import { PrismaInstallmentRepository } from './repositories/prisma-installment.repository';

/**
 * Implementación concreta del puerto UnitOfWork usando prisma.$transaction.
 */
@Injectable()
export class PrismaUnitOfWork extends UnitOfWork {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async execute<T>(
    work: (repos: {
      loans: LoanRepository;
      installments: InstallmentRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const loanRepo = new PrismaLoanRepository(tx);
      const installmentRepo = new PrismaInstallmentRepository(tx);

      return work({
        loans: loanRepo,
        installments: installmentRepo,
      });
    });
  }
}
