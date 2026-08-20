import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { GetPaymentDashboardUseCase } from '../loans/application/use-cases/get-payment-dashboard.use-case';
import { RegisterPaymentUseCase } from '../loans/application/use-cases/register-payment.use-case';
import { VoidPaymentUseCase } from '../loans/application/use-cases/void-payment.use-case';
import { LoanDomainError } from '../loans/domain/errors/loan-domain.errors';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import {
  ApiGetPaymentDashboardDoc,
  ApiRegisterPaymentDoc,
  ApiVoidPaymentDoc,
} from './payments.docs';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly registerPaymentUseCase: RegisterPaymentUseCase,
    private readonly voidPaymentUseCase: VoidPaymentUseCase,
    private readonly getPaymentDashboardUseCase: GetPaymentDashboardUseCase,
  ) {}

  @Get('dashboard')
  @ApiGetPaymentDashboardDoc()
  async getDashboard(@CurrentUser() user: JwtPayload) {
    const data = await this.getPaymentDashboardUseCase.execute(user.sub);
    return { data };
  }

  @Post()
  @ApiRegisterPaymentDoc()
  async register(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterPaymentDto,
  ) {
    try {
      const data = await this.registerPaymentUseCase.execute(user.sub, dto);
      return {
        data,
        message: 'Payment registered successfully',
      };
    } catch (error) {
      if (error instanceof LoanDomainError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiVoidPaymentDoc()
  async void(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: VoidPaymentDto,
  ) {
    try {
      await this.voidPaymentUseCase.execute(user.sub, id, dto.reason);
      return {
        message: 'Payment voided successfully',
      };
    } catch (error) {
      if (error instanceof LoanDomainError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
