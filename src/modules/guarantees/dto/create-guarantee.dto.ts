import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { GuaranteeType } from '../../../generated/prisma/client';

export class CreateGuaranteeDto {
  @ApiProperty({
    description: 'ID del cliente propietario de la garantía',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    enum: GuaranteeType,
    description: 'Tipo de garantía (VEHICLE, REAL_ESTATE, FURNITURE, OTHER)',
    example: GuaranteeType.VEHICLE,
  })
  @IsEnum(GuaranteeType)
  type: GuaranteeType;

  @ApiProperty({
    description: 'Descripción detallada de la garantía',
    example: 'Motocicleta Honda Wave 110cc Placa 4589-XYZ color rojo',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Valor estimado de la garantía en la moneda del negocio',
    example: 1500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional({
    description: 'Campo de imagen para multipart/form-data',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  image?: unknown;
}
