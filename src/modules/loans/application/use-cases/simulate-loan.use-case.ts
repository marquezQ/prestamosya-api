import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { LoanScheduleType } from '../../domain/enums';
import { LoanCalculatorService } from '../../domain/services/loan-calculator.service';
import { Money } from '../../domain/value-objects/money.vo';
import { SimulateLoanDto } from '../../dto/simulate-loan.dto';
import { InstallmentEntity } from '../../domain/entities/installment.entity';

export interface SimulationResult {
  installments: InstallmentEntity[];
  totalAmount: Money;
  capitalAmount: Money;
}

@Injectable()
export class SimulateLoanUseCase {
  constructor(private readonly calculator: LoanCalculatorService) {}

  execute(dto: SimulateLoanDto): SimulationResult {
    const capital = Money.of(dto.capitalAmount, dto.currency);
    const interestRate = new Decimal(dto.interestRate);
    const startDate = new Date(dto.startDate);

    const calcParams = {
      capital,
      interestRate,
      totalInstallments: dto.totalInstallments,
      startDate,
      periodType: dto.periodType,
    };

    const result =
      dto.scheduleType === LoanScheduleType.INTEREST_ONLY
        ? this.calculator.calculateInterestOnlyInstallments(calcParams)
        : this.calculator.calculateInstallments(calcParams);

    return {
      installments: result.installments,
      totalAmount: result.totalAmount,
      capitalAmount: capital,
    };
  }
}
