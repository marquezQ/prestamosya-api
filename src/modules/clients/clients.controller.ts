import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import {
  ApiCreateClientDoc,
  ApiFindAllClientsDoc,
  ApiFindOneClientDoc,
  ApiRemoveClientDoc,
  ApiUpdateClientDoc,
} from './clients.docs';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiFindAllClientsDoc()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.clientsService.findAll(user.sub);
  }

  @Post()
  @ApiCreateClientDoc()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.sub, dto);
  }

  @Get(':id')
  @ApiFindOneClientDoc()
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiUpdateClientDoc()
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiRemoveClientDoc()
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.remove(user.sub, id);
  }
}
