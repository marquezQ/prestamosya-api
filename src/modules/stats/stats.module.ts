import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { PdfBuilderService } from './pdf-builder.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, PdfBuilderService],
})
export class StatsModule {}
