import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { GetHomeDashboardUseCase } from './application/use-cases/get-home-dashboard.use-case';

@Module({
  controllers: [DashboardController],
  providers: [GetHomeDashboardUseCase],
  exports: [GetHomeDashboardUseCase],
})
export class DashboardModule {}
