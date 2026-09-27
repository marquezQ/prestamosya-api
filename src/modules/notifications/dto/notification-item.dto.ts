import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../generated/prisma/client';

export class NotificationItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiPropertyOptional({ type: Object })
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true, type: Date })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
