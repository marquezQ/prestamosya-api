import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoanCalculatorService } from './domain/services/loan-calculator.service';
import { LoanRepository } from './domain/repositories/loan.repository';
import { InstallmentRepository } from './domain/repositories/installment.repository';
import { UnitOfWork } from './application/ports/unit-of-work.port';
import { CreateLoanUseCase } from './application/use-cases/create-loan.use-case';
import { PrismaLoanRepository } from './infrastructure/repositories/prisma-loan.repository';
import { PrismaInstallmentRepository } from './infrastructure/repositories/prisma-installment.repository';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work';
import { LoansController } from './infrastructure/loans.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LoansController],
  providers: [
    LoanCalculatorService,
    CreateLoanUseCase,
    {
      provide: LoanRepository,
      useClass: PrismaLoanRepository,
    },
    {
      provide: InstallmentRepository,
      useClass: PrismaInstallmentRepository,
    },
    {
      provide: UnitOfWork,
      useClass: PrismaUnitOfWork,
    },
  ],
  exports: [
    CreateLoanUseCase,
    UnitOfWork,
    LoanRepository,
    InstallmentRepository,
  ],
})
export class LoansModule {}
