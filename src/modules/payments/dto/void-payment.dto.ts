import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidPaymentDto {
  @ApiProperty({ default: 'Error de digitación en el monto' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
