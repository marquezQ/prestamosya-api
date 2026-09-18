// src/modules/business-config/business-config.controller.ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BusinessConfigService } from './business-config.service';
import {
  ApiGetBusinessConfigDoc,
  ApiUpdateBusinessConfigDoc,
} from './business-config.docs';
import { BusinessConfigResponseDto } from './dto/business-config-response.dto';
import { UpdateBusinessConfigDto } from './dto/update-business-config.dto';

@ApiTags('business-config')
@Controller('business-config')
export class BusinessConfigController {
  constructor(private readonly businessConfigService: BusinessConfigService) {}

  @Get()
  @ApiGetBusinessConfigDoc()
  get(@CurrentUser() user: JwtPayload): Promise<BusinessConfigResponseDto> {
    return this.businessConfigService.getForUser(user.sub);
  }

  @Patch()
  @ApiUpdateBusinessConfigDoc()
  update(
    @CurrentUser() user: JwtPayload,
    @Body() updateDto: UpdateBusinessConfigDto,
  ): Promise<BusinessConfigResponseDto> {
    return this.businessConfigService.updateForUser(user.sub, updateDto);
  }
}
