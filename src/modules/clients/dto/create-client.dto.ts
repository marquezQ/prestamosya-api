import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ default: 'María Quispe Mamani', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ default: '71234567', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ default: '5555555 LP', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  idNumber: string;

  @ApiPropertyOptional({ default: '70123456', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneAlt?: string;

  @ApiPropertyOptional({ default: 'Av. Arce 123, La Paz' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ default: -16.5001 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ default: -68.1342 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ default: 'Prefiere cobro por las mañanas.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
