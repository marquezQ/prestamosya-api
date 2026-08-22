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

/** Tipos MIME de imagen válidos (incluyendo heic/heif de móviles y octet-stream). */
const VALID_IMAGE_MIME_TYPES = /(image\/|application\/octet-stream)/i;

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

function extractBuffer(
  image?: Express.Multer.File,
  dtoImage?: unknown,
): Buffer | undefined {
  if (image?.buffer && Buffer.isBuffer(image.buffer)) {
    return image.buffer;
  }
  if (
    dtoImage &&
    typeof dtoImage === 'object' &&
    dtoImage !== null &&
    'buffer' in dtoImage
  ) {
    const b = dtoImage.buffer;
    if (Buffer.isBuffer(b)) return b;
  }
  if (Buffer.isBuffer(dtoImage)) {
    return dtoImage;
  }
  return undefined;
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
    const buffer = extractBuffer(image, dto.image);

    const data = await this.guaranteesService.create(
      user.sub,
      user.name,
      dto,
      buffer,
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
    const buffer = extractBuffer(image, dto.image);

    const data = await this.guaranteesService.update(
      user.sub,
      user.name,
      id,
      dto,
      buffer,
    );
    return { data, message: 'Guarantee updated successfully' };
  }

  @Delete(':id')
  @ApiDeleteGuaranteeDoc()
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return await this.guaranteesService.remove(user.sub, id);
  }
}
