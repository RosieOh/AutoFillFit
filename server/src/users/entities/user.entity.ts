import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resume } from '../../resume/entities/resume.entity';
import { Profile } from './profile.entity';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /**
   * 백오피스 접근 권한. 가입으로는 절대 부여되지 않고,
   * `npm run admin:grant -- <email>` 또는 기존 관리자만 승격할 수 있다.
   */
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  /** false면 로그인은 되지만 모든 인증 요청이 거부된다(계정 비활성화). */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * bcrypt 해시. select: false 이므로 기본 조회에서 제외되며,
   * 로그인 검증 시에만 addSelect / select 옵션으로 명시 조회한다.
   */
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  /**
   * 연속 로그인 실패 횟수.
   *
   * 성공하면 0으로 돌아간다. IP 기준 제한만으로는 여러 IP를 돌려 쓰는
   * 크리덴셜 스터핑을 막지 못하므로 계정 단위로도 센다.
   */
  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  /** 이 시각까지 로그인을 거부한다. null이면 잠금 없음. */
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => Profile, (profile) => profile.user, {
    cascade: ['insert', 'update'],
  })
  profile: Profile;

  @OneToMany(() => Resume, (resume) => resume.user, {
    cascade: ['insert', 'update'],
  })
  resumes: Resume[];
}
