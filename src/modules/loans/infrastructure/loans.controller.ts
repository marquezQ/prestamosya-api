import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateLoanUseCase } from '../application/use-cases/create-loan.use-case';
import { SimulateLoanUseCase } from '../application/use-cases/simulate-loan.use-case';
import { LinkGuaranteeUseCase } from '../application/use-cases/link-guarantee.use-case';
import { UnlinkGuaranteeUseCase } from '../application/use-cases/unlink-guarantee.use-case';
import { GetLoanDetailUseCase } from '../application/use-cases/get-loan-detail.use-case';
import { ListLoansUseCase } from '../application/use-cases/list-loans.use-case';
import { CreateLoanDto } from '../dto/create-loan.dto';
import { SimulateLoanDto } from '../dto/simulate-loan.dto';
import { LinkGuaranteeDto } from '../dto/link-guarantee.dto';
import { ListLoansQueryDto } from '../dto/list-loans.query.dto';
import { LoanDomainError } from '../domain/errors/loan-domain.errors';
import { LoanMapper } from './mappers/loan.mapper';
import { InstallmentMapper } from './mappers/installment.mapper';
import {
  ApiLoansTag,
  ApiCreateLoanDoc,
  ApiSimulateLoanDoc,
  ApiLinkGuaranteeDoc,
  ApiUnlinkGuaranteeDoc,
  ApiGetLoanDetailDoc,
  ApiGetLoanInstallmentsDoc,
  ApiListLoansDoc,
} from '../loans.docs';

@ApiLoansTag()
@Controller('loans')
export class LoansController {
  constructor(
    private readonly createLoanUseCase: CreateLoanUseCase,
    private readonly simulateLoanUseCase: SimulateLoanUseCase,
    private readonly linkGuaranteeUseCase: LinkGuaranteeUseCase,
    private readonly unlinkGuaranteeUseCase: UnlinkGuaranteeUseCase,
    private readonly getLoanDetailUseCase: GetLoanDetailUseCase,
    private readonly listLoansUseCase: ListLoansUseCase,
  ) {}

  @Get()
  @ApiListLoansDoc()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListLoansQueryDto,
  ) {
    const data = await this.listLoansUseCase.execute(user.sub, query);
    return { data };
  }

  @Post()
  @ApiCreateLoanDoc()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLoanDto) {
    try {
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

  @Post(':id/guarantees')
  @ApiLinkGuaranteeDoc()
  async linkGuarantee(
    @CurrentUser() user: JwtPayload,
    @Param('id') loanId: string,
    @Body() dto: LinkGuaranteeDto,
  ) {
    const data = await this.linkGuaranteeUseCase.execute(
      user.sub,
      loanId,
      dto.guaranteeId,
    );
    return { data, message: 'Guarantee linked successfully' };
  }

  @Delete(':id/guarantees/:guaranteeId')
  @ApiUnlinkGuaranteeDoc()
  async unlinkGuarantee(
    @CurrentUser() user: JwtPayload,
    @Param('id') loanId: string,
    @Param('guaranteeId') guaranteeId: string,
  ) {
    return await this.unlinkGuaranteeUseCase.execute(
      user.sub,
      loanId,
      guaranteeId,
    );
  }

  @Get(':id')
  @ApiGetLoanDetailDoc()
  async getDetail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.getLoanDetailUseCase.execute(user.sub, id);
    return { data };
  }

  @Get(':id/installments')
  @ApiGetLoanInstallmentsDoc()
  async getInstallments(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.getLoanDetailUseCase.getInstallments(user.sub, id);
    return { data };
  }
}
