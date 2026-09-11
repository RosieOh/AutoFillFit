import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EducationDegree,
  EducationStatus,
  EssayType,
} from '../types/resume-json.types';

/** YYYY-MM 형식 (입사/졸업년월) */
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_MONTH_MESSAGE = 'YYYY-MM 형식이어야 합니다.';

/** JSONB는 DB가 형태를 강제하지 않으므로, 각 항목을 여기서 검증한다. */
export class EducationItemDto {
  @IsString()
  @MaxLength(120)
  schoolName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  major?: string;

  @IsOptional()
  @IsEnum(EducationDegree)
  degree?: EducationDegree;

  @IsOptional()
  @IsEnum(EducationStatus)
  status?: EducationStatus;

  @IsOptional()
  @IsNumberString({}, { message: 'gpa는 숫자 형식의 문자열이어야 합니다.' })
  gpa?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'gpaScale은 숫자 형식의 문자열이어야 합니다.' })
  gpaScale?: string;

  @IsOptional()
  @Matches(YEAR_MONTH, { message: `admissionDate는 ${YEAR_MONTH_MESSAGE}` })
  admissionDate?: string;

  @IsOptional()
  @Matches(YEAR_MONTH, { message: `graduationDate는 ${YEAR_MONTH_MESSAGE}` })
  graduationDate?: string;
}

export class CareerItemDto {
  @IsString()
  @MaxLength(120)
  companyName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  position?: string;

  @IsOptional()
  @Matches(YEAR_MONTH, { message: `joinDate는 ${YEAR_MONTH_MESSAGE}` })
  joinDate?: string;

  @IsOptional()
  @Matches(YEAR_MONTH, { message: `leaveDate는 ${YEAR_MONTH_MESSAGE}` })
  leaveDate?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsString()
  mainTasks?: string;
}

export class CertificateItemDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  issuer?: string;

  @IsOptional()
  @IsDateString({}, { message: 'acquiredAt은 YYYY-MM-DD 형식이어야 합니다.' })
  acquiredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  score?: string;
}

export class EssayItemDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsEnum(EssayType)
  type?: EssayType;

  @IsString()
  content: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  charLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
