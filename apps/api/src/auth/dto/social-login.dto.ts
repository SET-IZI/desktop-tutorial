import { IsIn, IsString } from 'class-validator';

export class SocialLoginDto {
  @IsIn(['GOOGLE', 'APPLE', 'FACEBOOK'])
  provider!: 'GOOGLE' | 'APPLE' | 'FACEBOOK';

  @IsString()
  idToken!: string;
}
