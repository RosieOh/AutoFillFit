import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** POST /auth/forgot-password */
export class ForgotPasswordDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(255)
  email: string;
}

/** POST /auth/reset-password */
export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: '재설정 링크가 올바르지 않습니다.' })
  @MaxLength(128)
  token: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '비밀번호는 영문과 숫자를 모두 포함해야 합니다.',
  })
  password: string;
}
