import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OverdueProcessorService } from './services/overdue-processor.service';
import { ApiRecalculateOverdueDoc } from './cron.docs';

@ApiTags('admin')
@Controller('admin')
export class CronController {
  constructor(private readonly overdueProcessor: OverdueProcessorService) {}

  @Post('recalculate-overdue')
  @HttpCode(HttpStatus.OK)
  @ApiRecalculateOverdueDoc()
  async recalculateOverdue() {
    const summary = await this.overdueProcessor.processOverdue();
    return {
      data: summary,
      message: 'Overdue recalculation completed successfully',
    };
  }
}
