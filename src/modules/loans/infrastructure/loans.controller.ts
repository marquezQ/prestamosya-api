import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CreateLoanUseCase } from '../application/use-cases/create-loan.use-case';
import { CreateLoanDto } from '../dto/create-loan.dto';
import { LoanDomainError } from '../domain/errors/loan-domain.errors';
import { LoanMapper } from './mappers/loan.mapper';

@ApiTags('loans')
@ApiBearerAuth('access-token')
@Controller('loans')
export class LoansController {
  constructor(private readonly createLoanUseCase: CreateLoanUseCase) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo préstamo',
    description:
      'Genera un préstamo en modo automático (calcula cuotas flat rate) o manual. Persiste préstamo y cuotas en una sola transacción.',
  })
  @ApiResponse({
    status: 201,
    description: 'Préstamo creado exitosamente con sus cuotas.',
  })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateLoanDto) {
    try {
      const loanEntity = await this.createLoanUseCase.execute(userId, dto);
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
}
