import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  GuaranteeStatus,
  GuaranteeType,
} from '../../../generated/prisma/client';

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

  @ApiPropertyOptional({
    description:
      'URL pública de la imagen en Cloudinary (WebP) o null si la garantía no tiene foto',
    example:
      'https://res.cloudinary.com/demo/image/upload/v123456/Juan%20Perez/garantias/sample.webp',
  })
  imageUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
