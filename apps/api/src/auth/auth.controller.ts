import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Connexion Google / Apple / Facebook : le client mobile envoie le token
  // du provider, vérifié côté serveur avant émission du JWT BarberPro.
  @Post('social')
  social(@Body() dto: SocialLoginDto) {
    return this.auth.socialLogin(dto);
  }
}
