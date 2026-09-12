import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 탈퇴 요청.
 *
 * 비밀번호를 다시 받는다. 토큰만으로 지우게 하면, 잠깐 자리를 비운 사이
 * 열린 브라우저에서 되돌릴 수 없는 삭제가 일어난다.
 */
export class DeleteMeDto {
  @IsString()
  @MinLength(1, { message: '비밀번호를 입력해 주세요.' })
  @MaxLength(64)
  password: string;
}
