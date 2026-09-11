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

export enum AdminAction {
  /** 마스킹을 해제하고 개인정보 원본을 열람 */
  REVEAL_PII = 'REVEAL_PII',
  UPDATE_ROLE = 'UPDATE_ROLE',
  UPDATE_STATUS = 'UPDATE_STATUS',
  DELETE_USER = 'DELETE_USER',
}

/**
 * 관리자 행위 기록.
 * 특히 개인정보 원본 열람(REVEAL_PII)은 "누가 언제 누구 것을 봤는지"가 남아야
 * 마스킹이 형식적인 장치에 그치지 않는다.
 */
@Entity('admin_audit_logs')
@Index('idx_audit_created', ['createdAt'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AdminAction })
  action: AdminAction;

  /** 행위자 — 관리자 계정이 지워져도 기록은 남기므로 SET NULL */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  /** 관리자 이메일 스냅샷 — 계정이 삭제돼도 누구였는지 남는다. */
  @Column({ name: 'actor_email', type: 'varchar', length: 255 })
  actorEmail: string;

  /** 대상 사용자 — 삭제된 사용자도 추적할 수 있게 FK를 걸지 않는다. */
  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId: string | null;

  @Column({ name: 'target_email', type: 'varchar', length: 255, nullable: true })
  targetEmail: string | null;

  /** 변경 전후 값 등 부가 정보 */
  @Column({ type: 'jsonb', nullable: true })
  detail: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
