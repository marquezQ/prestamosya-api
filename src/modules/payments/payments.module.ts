import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [LoansModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
