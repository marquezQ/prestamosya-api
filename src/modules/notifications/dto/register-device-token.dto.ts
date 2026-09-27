import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'Token de expo-notifications (APK/Expo)' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({
    description: 'Plataforma (expo | fcm | webpush)',
    default: 'expo',
  })
  @IsNotEmpty()
  @IsString()
  platform: string;
}
