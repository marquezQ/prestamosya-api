import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { LoanCalculatorService } from './domain/services/loan-calculator.service';
import { LoanRepository } from './domain/repositories/loan.repository';
import { InstallmentRepository } from './domain/repositories/installment.repository';
import { UnitOfWork } from './application/ports/unit-of-work.port';
import { CreateLoanUseCase } from './application/use-cases/create-loan.use-case';
import { SimulateLoanUseCase } from './application/use-cases/simulate-loan.use-case';
import { LinkGuaranteeUseCase } from './application/use-cases/link-guarantee.use-case';
import { UnlinkGuaranteeUseCase } from './application/use-cases/unlink-guarantee.use-case';
import { GetLoanDetailUseCase } from './application/use-cases/get-loan-detail.use-case';
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
    SimulateLoanUseCase,
    LinkGuaranteeUseCase,
    UnlinkGuaranteeUseCase,
    GetLoanDetailUseCase,
    // useFactory garantiza que PrismaService se inyecta explícitamente.
    // No podemos usar useClass porque el constructor recibe PrismaClientLike
    // (type alias), que TypeScript compila a `Object` en reflect-metadata
    // y NestJS no puede resolverlo como token de DI.
    {
      provide: LoanRepository,
      useFactory: (prisma: PrismaService) => new PrismaLoanRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: InstallmentRepository,
      useFactory: (prisma: PrismaService) =>
        new PrismaInstallmentRepository(prisma),
      inject: [PrismaService],
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
