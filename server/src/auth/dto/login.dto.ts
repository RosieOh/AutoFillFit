import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
