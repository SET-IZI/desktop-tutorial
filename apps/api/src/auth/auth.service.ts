import {
  ConflictException,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Un compte existe déjà avec cet email');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      },
    });
    return this.issueToken(user.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return this.issueToken(user.id, user.role);
  }

  async socialLogin(dto: SocialLoginDto) {
    // TODO: vérifier dto.idToken auprès de Google / Apple / Facebook,
    // puis créer ou retrouver l'utilisateur correspondant.
    throw new NotImplementedException(`Connexion ${dto.provider} à venir`);
  }

  private issueToken(userId: string, role: string) {
    return {
      accessToken: this.jwt.sign({ sub: userId, role }),
    };
  }
}
