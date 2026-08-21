import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
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

/** 20 MB en bytes — cubre fotos de alta resolución de smartphones modernos. Sharp optimiza antes de subir. */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Tipos MIME de imagen válidos. */
const VALID_IMAGE_MIME_TYPES = /^image\/(jpeg|jpg|png|webp|gif|bmp|tiff)$/;

/** ParseFilePipe reutilizable: valida tipo MIME y tamaño máximo. Opcional (fileIsRequired: false). */
function buildImagePipe() {
  return new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
      new FileTypeValidator({ fileType: VALID_IMAGE_MIME_TYPES }),
    ],
    fileIsRequired: false,
  });
}

@ApiTags('guarantees')
@Controller('guarantees')
export class GuaranteesController {
  constructor(private readonly guaranteesService: GuaranteesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiCreateGuaranteeDoc()
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGuaranteeDto,
    @UploadedFile(buildImagePipe()) image?: Express.Multer.File,
  ) {
    const data = await this.guaranteesService.create(
      user.sub,
      user.name,
      dto,
      image?.buffer,
    );
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
  @ApiConsumes('multipart/form-data')
  @ApiUpdateGuaranteeDoc()
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGuaranteeDto,
    @UploadedFile(buildImagePipe()) image?: Express.Multer.File,
  ) {
    const data = await this.guaranteesService.update(
      user.sub,
      user.name,
      id,
      dto,
      image?.buffer,
    );
    return { data, message: 'Guarantee updated successfully' };
  }

  @Delete(':id')
  @ApiDeleteGuaranteeDoc()
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return await this.guaranteesService.remove(user.sub, id);
  }
}
