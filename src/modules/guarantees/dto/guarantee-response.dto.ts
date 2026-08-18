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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
