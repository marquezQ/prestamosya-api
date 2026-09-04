import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { GetHomeDashboardUseCase } from './application/use-cases/get-home-dashboard.use-case';
import { ApiGetHomeDashboardDoc } from './dashboard.docs';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly getHomeDashboardUseCase: GetHomeDashboardUseCase,
  ) {}

  @Get('home')
  @ApiGetHomeDashboardDoc()
  async getHomeDashboard(@CurrentUser() user: JwtPayload) {
    const data = await this.getHomeDashboardUseCase.execute(user.sub);
    return {
      data,
      message: 'Home dashboard metrics retrieved successfully',
    };
  }
}
