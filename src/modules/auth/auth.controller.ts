import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ApiLoginDoc, ApiLogoutDoc, ApiMeDoc } from './auth.docs';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiLoginDoc()
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @ApiMeDoc()
  getMe(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiLogoutDoc()
  logout(): { message: string } {
    return this.authService.logout();
  }
}
