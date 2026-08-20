import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { OverdueProcessorService } from './services/overdue-processor.service';
import { OverdueCron } from './overdue.cron';
import { CronController } from './cron.controller';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  controllers: [CronController],
  providers: [OverdueProcessorService, OverdueCron],
  exports: [OverdueProcessorService],
})
export class CronModule {}
