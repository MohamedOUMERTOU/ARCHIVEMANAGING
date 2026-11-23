import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Public } from '../common/decorators';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
