// src/modules/business-config/business-config.module.ts
import { Module } from '@nestjs/common';
import { BusinessConfigController } from './business-config.controller';
import { BusinessConfigService } from './business-config.service';

@Module({
  controllers: [BusinessConfigController],
  providers: [BusinessConfigService],
})
export class BusinessConfigModule {}
