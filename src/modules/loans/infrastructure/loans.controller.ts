import {
  Body,
  Controller,
  Post,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateLoanUseCase } from '../application/use-cases/create-loan.use-case';
import { SimulateLoanUseCase } from '../application/use-cases/simulate-loan.use-case';
import { CreateLoanDto } from '../dto/create-loan.dto';
import { SimulateLoanDto } from '../dto/simulate-loan.dto';
import { LoanDomainError } from '../domain/errors/loan-domain.errors';
import { LoanMapper } from './mappers/loan.mapper';
import { InstallmentMapper } from './mappers/installment.mapper';
import { ApiCreateLoanDoc, ApiSimulateLoanDoc } from '../loans.docs';

@ApiTags('loans')
@Controller('loans')
export class LoansController {
  constructor(
    private readonly createLoanUseCase: CreateLoanUseCase,
    private readonly simulateLoanUseCase: SimulateLoanUseCase,
  ) {}

  @Post()
  @ApiCreateLoanDoc()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLoanDto) {
    try {
      // user.sub es el UUID del usuario autenticado, firmado en el JWT al hacer login
      const loanEntity = await this.createLoanUseCase.execute(user.sub, dto);
      return {
        data: LoanMapper.toResponseDto(loanEntity),
        message: 'Loan created successfully',
      };
    } catch (error) {
      if (error instanceof LoanDomainError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiSimulateLoanDoc()
  simulate(@Body() dto: SimulateLoanDto) {
    try {
      const result = this.simulateLoanUseCase.execute(dto);
      return {
        data: {
          capitalAmount: result.capitalAmount.toNumber(),
          totalAmount: result.totalAmount.toNumber(),
          installments: result.installments.map((inst) =>
            InstallmentMapper.toResponseDto(inst),
          ),
        },
        message: 'Simulation successful',
      };
    } catch (error) {
      if (error instanceof LoanDomainError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
