import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CareerItemDto,
  CertificateItemDto,
  EducationItemDto,
  EssayItemDto,
} from './resume-json.dto';

export class UpsertProfileDto {
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

/**
 * PATCH /api/resume/my 요청 본문.
 *
 * Upsert 규칙:
 * - 프로필/이력서 레코드가 없으면 새로 만들고, 있으면 수정한다.
 * - 스칼라 필드는 본문에 포함된 것만 반영한다(미지정 필드는 기존 값 유지).
 * - JSONB 배열은 지정한 배열만 통째로 교체한다(부분 병합하지 않음).
 * - `extra`는 기존 객체와 얕게 병합한다.
 */
export class UpsertMyResumeDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertProfileDto)
  profile?: UpsertProfileDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headline?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationItemDto)
  education?: EducationItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CareerItemDto)
  careers?: CareerItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificateItemDto)
  certificates?: CertificateItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EssayItemDto)
  essays?: EssayItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
