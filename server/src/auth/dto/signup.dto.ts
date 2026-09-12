import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '비밀번호는 영문과 숫자를 모두 포함해야 합니다.',
  })
  password: string;

  /**
   * 필수 동의 두 가지.
   *
   * 개인정보보호법 제15조는 수집·이용에 대한 동의를 요구한다.
   * 선택이 아니라 필수이므로 @IsOptional을 붙이지 않고, true가 아니면 400을 낸다.
   * 화면에서 체크박스를 빠뜨려도 서버가 막는다.
   */
  @IsBoolean()
  @Equals(true, { message: '이용약관에 동의해야 가입할 수 있습니다.' })
  termsAgreed: boolean;

  @IsBoolean()
  @Equals(true, { message: '개인정보 수집·이용에 동의해야 가입할 수 있습니다.' })
  privacyAgreed: boolean;

  /** 회원가입과 동시에 기본 인적사항을 생성한다 (선택). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Matches(/^[0-9-+()\s]{9,20}$/, { message: '올바른 전화번호 형식이 아닙니다.' })
  phone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'birthdate는 YYYY-MM-DD 형식이어야 합니다.' })
  birthdate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @Matches(/^\d{5}$|^\d{3}-\d{3}$/, {
    message: 'zipCode는 5자리 우편번호 형식이어야 합니다.',
  })
  zipCode?: string;
}
