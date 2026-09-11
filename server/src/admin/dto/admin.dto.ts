import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export enum UserSortField {
  CREATED_AT = 'createdAt',
  EMAIL = 'email',
  COMPLETENESS = 'completeness',
  UPDATED_AT = 'updatedAt',
}

export class ListUsersQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** 이메일 부분 검색 */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(UserSortField)
  sort?: UserSortField = UserSortField.CREATED_AT;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

export enum RevealReason {
  /** 문의 대응 */
  SUPPORT = 'SUPPORT',
  /** 신고 조사 */
  ABUSE_REPORT = 'ABUSE_REPORT',
  /** 본인 요청 */
  USER_REQUEST = 'USER_REQUEST',
}

export const REVEAL_REASON_LABELS: Record<RevealReason, string> = {
  SUPPORT: '문의 대응',
  ABUSE_REPORT: '신고 조사',
  USER_REQUEST: '본인 요청',
};

export class UserDetailQueryDto {
  /**
   * true면 개인정보 원본을 반환하고 감사 로그를 남긴다.
   * 기본값은 false(마스킹).
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  reveal?: boolean = false;

  /**
   * 열람 사유. reveal=true면 필수다.
   * 사유 없는 열람을 허용하면 감사 로그가 "누가 봤다"까지만 남고
   * "왜 봤는지"가 비어 사후 검토가 불가능해진다.
   */
  @IsOptional()
  @IsEnum(RevealReason)
  reason?: RevealReason;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListAuditLogsQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}
