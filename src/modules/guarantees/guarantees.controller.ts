import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
import { UpdateGuaranteeDto } from './dto/update-guarantee.dto';
import {
  ApiCreateGuaranteeDoc,
  ApiDeleteGuaranteeDoc,
  ApiGetGuaranteeByIdDoc,
  ApiGetGuaranteesByClientDoc,
  ApiUpdateGuaranteeDoc,
} from './guarantees.docs';
import { GuaranteesService } from './guarantees.service';

@ApiTags('guarantees')
@Controller('guarantees')
export class GuaranteesController {
  constructor(private readonly guaranteesService: GuaranteesService) {}

  @Post()
  @ApiCreateGuaranteeDoc()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGuaranteeDto,
  ) {
    const data = await this.guaranteesService.create(user.sub, dto);
    return { data, message: 'Guarantee created successfully' };
  }

  @Get()
  @ApiGetGuaranteesByClientDoc()
  async findByClient(
    @CurrentUser() user: JwtPayload,
    @Query('clientId') clientId: string,
  ) {
    const data = await this.guaranteesService.findByClient(user.sub, clientId);
    return { data };
  }

  @Get(':id')
  @ApiGetGuaranteeByIdDoc()
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.guaranteesService.findOne(user.sub, id);
    return { data };
  }

  @Patch(':id')
  @ApiUpdateGuaranteeDoc()
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGuaranteeDto,
  ) {
    const data = await this.guaranteesService.update(user.sub, id, dto);
    return { data, message: 'Guarantee updated successfully' };
  }

  @Delete(':id')
  @ApiDeleteGuaranteeDoc()
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return await this.guaranteesService.remove(user.sub, id);
  }
}
