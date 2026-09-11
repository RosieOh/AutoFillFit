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
