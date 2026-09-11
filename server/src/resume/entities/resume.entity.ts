import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  CareerItem,
  CertificateItem,
  EducationItem,
  EssayItem,
} from '../types/resume-json.types';

/**
 * 마스터 이력서 — User와 1:N.
 *
 * 학력/경력/자격증/자기소개서는 채용 사이트마다 요구 항목이 제각각이라
 * 정규화 대신 JSONB 배열로 저장한다. 스키마 변경 없이 항목을 늘릴 수 있고,
 * 자동입력 시 어차피 이력서 전체를 한 번에 읽으므로 조인 이득도 없다.
 * 대신 DB가 형태를 강제하지 않으므로 쓰기 경로에서 DTO 검증이 필수다.
 */
@Entity('resumes')
@Index('idx_resumes_user_updated', ['userId', 'updatedAt'])
export class Resume {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, default: '기본 이력서' })
  title: string;

  /** 자동입력에 사용할 대표 이력서 여부 */
  @Column({ name: 'is_primary', type: 'boolean', default: true })
  isPrimary: boolean;

  /** 한 줄 소개 / 헤드라인 */
  @Column({ type: 'varchar', length: 255, nullable: true })
  headline: string | null;

  /** 학력 — 학교명, 전공, 학점, 입학/졸업년월 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  education: EducationItem[];

  /** 경력 — 회사명, 부서, 직무, 입사/퇴사년월, 주요업무 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  careers: CareerItem[];

  /** 자격증 — 자격증명, 발급기관, 취득일 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  certificates: CertificateItem[];

  /** 자기소개서 — 문항 제목/유형, 답변 내용 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  essays: EssayItem[];

  /** 스킬 키워드 (예: ["TypeScript", "Nest.js"]) */
  @Column({ type: 'jsonb', nullable: true })
  skills: string[] | null;

  /** 위 항목에 속하지 않는 임의 필드 (병역, 보훈, 희망연봉 등) */
  @Column({ type: 'jsonb', nullable: true })
  extra: Record<string, unknown> | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.resumes, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
