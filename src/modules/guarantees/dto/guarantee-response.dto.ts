import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  GuaranteeStatus,
  GuaranteeType,
} from '../../../generated/prisma/client';

export class GuaranteePhotoDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'URL pública de la imagen en Cloudinary (WebP)' })
  fileUrl: string;

  @ApiProperty()
  createdAt: Date;
}

export class GuaranteeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty({ enum: GuaranteeType })
  type: GuaranteeType;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  estimatedValue: number | null;

  @ApiProperty({ enum: GuaranteeStatus })
  status: GuaranteeStatus;

  @ApiProperty({ type: [GuaranteePhotoDto] })
  photos: GuaranteePhotoDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
