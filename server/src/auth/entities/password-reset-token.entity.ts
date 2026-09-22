import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * 비밀번호 재설정 토큰.
 *
 * 토큰 원문은 저장하지 않는다. DB가 유출되면 그 값으로 아무 계정의
 * 비밀번호나 바꿀 수 있기 때문이다. 비밀번호와 같은 이유로 해시만 남긴다.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_password_reset_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** sha256(토큰). 조회는 이 값으로 한다. */
  @Index('uq_password_reset_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** 한 번 쓰면 다시 못 쓴다. 메일이 전달되는 경로는 안전하지 않다. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
