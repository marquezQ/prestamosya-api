import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class LinkGuaranteeDto {
  @ApiProperty({
    description: 'ID de la garantía del cliente a vincular al préstamo',
    example: 'b1fbc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID()
  @IsNotEmpty()
  guaranteeId: string;
}
