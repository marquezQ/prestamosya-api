import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import {
  ApiClientsTag,
  ApiCreateClientDoc,
  ApiFindAllClientsDoc,
  ApiFindOneClientDoc,
  ApiRemoveClientDoc,
  ApiUpdateClientDoc,
} from './clients.docs';

/** 20 MB en bytes — fotos de smartphones modernos. Sharp optimiza antes de subir. */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Tipos MIME válidos (incluyendo heic/heif de móviles y octet-stream). */
const VALID_IMAGE_MIME_TYPES = /(image\/|application\/octet-stream)/i;

/** ParseFilePipe reutilizable: tipo MIME + tamaño. Opcional (fileIsRequired: false). */
function buildImagePipe() {
  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
      new FileTypeValidator({ fileType: VALID_IMAGE_MIME_TYPES }),
    ],
    fileIsRequired: false,
  });
}

@ApiClientsTag()
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
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClientDto,
    @UploadedFile(buildImagePipe()) image?: Express.Multer.File,
  ) {
    const buffer =
      image?.buffer && Buffer.isBuffer(image.buffer) ? image.buffer : undefined;
    return this.clientsService.create(user.sub, dto, buffer);
  }

  @Get(':id')
  @ApiFindOneClientDoc()
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiUpdateClientDoc()
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @UploadedFile(buildImagePipe()) image?: Express.Multer.File,
  ) {
    const buffer =
      image?.buffer && Buffer.isBuffer(image.buffer) ? image.buffer : undefined;
    return this.clientsService.update(user.sub, id, dto, buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiRemoveClientDoc()
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.remove(user.sub, id);
  }
}
