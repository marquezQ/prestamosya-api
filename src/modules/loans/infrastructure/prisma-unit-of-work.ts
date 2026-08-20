import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoanRepository } from '../domain/repositories/loan.repository';
import { InstallmentRepository } from '../domain/repositories/installment.repository';
import { PaymentRepository } from '../domain/repositories/payment.repository';
import { UnitOfWork } from '../application/ports/unit-of-work.port';
import { PrismaLoanRepository } from './repositories/prisma-loan.repository';
import { PrismaInstallmentRepository } from './repositories/prisma-installment.repository';
import { PrismaPaymentRepository } from './repositories/prisma-payment.repository';

/**
 * Implementación concreta del puerto UnitOfWork usando prisma.$transaction.
 *
 * Crea instancias transaccionales de los 3 repositorios (loans, installments, payments)
 * pasándoles el cliente `tx` de Prisma. Esto garantiza que todas las operaciones
 * dentro del callback se ejecuten en la misma transacción ACID.
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
      payments: PaymentRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const loanRepo = new PrismaLoanRepository(tx);
      const installmentRepo = new PrismaInstallmentRepository(tx);
      const paymentRepo = new PrismaPaymentRepository(tx);

      return work({
        loans: loanRepo,
        installments: installmentRepo,
        payments: paymentRepo,
      });
    });
  }
}
