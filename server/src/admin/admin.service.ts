import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { Resume } from '../resume/entities/resume.entity';
import { Profile } from '../users/entities/profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  ListAuditLogsQueryDto,
  ListUsersQueryDto,
  RevealReason,
  UpdateUserDto,
  UserSortField,
} from './dto/admin.dto';
import { AdminAction, AdminAuditLog } from './entities/admin-audit-log.entity';
import {
  calculateCompleteness,
  COMPLETENESS_WEIGHTS,
  type SectionBreakdown,
} from './utils/completeness.util';
import {
  maskAddress,
  maskBirthdate,
  maskEmail,
  maskName,
  maskPhone,
  maskZipCode,
} from './utils/mask.util';

/** completeness 정렬은 DB에서 계산할 수 없어 메모리로 가져온다. 그 상한. */
const IN_MEMORY_SORT_CAP = 5000;

export interface AdminUserRow {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  name: string | null;
  completeness: number;
  hasResume: boolean;
  resumeUpdatedAt: Date | null;
  /** 이 행의 값이 마스킹된 상태인지 */
  masked: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminStats {
  totals: {
    users: number;
    active: number;
    inactive: number;
    admins: number;
    withResume: number;
  };
  signups: { last7Days: number; last30Days: number };
  completeness: {
    average: number;
    /** 구간별 사용자 수 (0-24 / 25-49 / 50-74 / 75-100) */
    distribution: { bucket: string; count: number }[];
    sectionAverages: SectionBreakdown;
    sectionWeights: typeof COMPLETENESS_WEIGHTS;
  };
  /** 최근 30일 일별 가입자 수 (빈 날짜도 0으로 채움) */
  signupTrend: { date: string; count: number }[];
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepository: Repository<AdminAuditLog>,
  ) {}

  /* ------------------------------------------------------------------ *
   * 통계
   * ------------------------------------------------------------------ */

  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [users, profiles, resumes] = await Promise.all([
      this.userRepository.find({
        select: { id: true, role: true, isActive: true, createdAt: true },
      }),
      this.profileRepository.find(),
      this.resumeRepository.find(),
    ]);

    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
    const resumeByUser = this.pickLatestResumes(resumes);

    let completenessSum = 0;
    const sectionSums: SectionBreakdown = {
      profile: 0,
      history: 0,
      certificates: 0,
      essays: 0,
    };
    const buckets = { '0-24': 0, '25-49': 0, '50-74': 0, '75-100': 0 };

    for (const user of users) {
      const { total, sections } = calculateCompleteness(
        profileByUser.get(user.id),
        resumeByUser.get(user.id),
      );

      completenessSum += total;
      sectionSums.profile += sections.profile;
      sectionSums.history += sections.history;
      sectionSums.certificates += sections.certificates;
      sectionSums.essays += sections.essays;

      if (total < 25) buckets['0-24'] += 1;
      else if (total < 50) buckets['25-49'] += 1;
      else if (total < 75) buckets['50-74'] += 1;
      else buckets['75-100'] += 1;
    }

    const count = users.length || 1;
    const round1 = (value: number) => Math.round((value / count) * 10) / 10;

    return {
      totals: {
        users: users.length,
        active: users.filter((u) => u.isActive).length,
        inactive: users.filter((u) => !u.isActive).length,
        admins: users.filter((u) => u.role === UserRole.ADMIN).length,
        withResume: resumeByUser.size,
      },
      signups: {
        last7Days: users.filter((u) => u.createdAt >= days7).length,
        last30Days: users.filter((u) => u.createdAt >= days30).length,
      },
      completeness: {
        average: Math.round(completenessSum / count),
        distribution: Object.entries(buckets).map(([bucket, value]) => ({
          bucket,
          count: value,
        })),
        sectionAverages: {
          profile: round1(sectionSums.profile),
          history: round1(sectionSums.history),
          certificates: round1(sectionSums.certificates),
          essays: round1(sectionSums.essays),
        },
        sectionWeights: COMPLETENESS_WEIGHTS,
      },
      signupTrend: this.buildSignupTrend(users, 30),
    };
  }

  /** 가입이 없는 날도 0으로 채워야 그래프의 시간축이 왜곡되지 않는다. */
  private buildSignupTrend(
    users: Pick<User, 'createdAt'>[],
    days: number,
  ): { date: string; count: number }[] {
    const counts = new Map<string, number>();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      counts.set(this.toDateKey(date), 0);
    }

    for (const user of users) {
      const key = this.toDateKey(user.createdAt);
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()].map(([date, count]) => ({ date, count }));
  }

  private toDateKey(date: Date): string {
    const local = new Date(date);
    const month = `${local.getMonth() + 1}`.padStart(2, '0');
    const day = `${local.getDate()}`.padStart(2, '0');
    return `${local.getFullYear()}-${month}-${day}`;
  }

  /* ------------------------------------------------------------------ *
   * 사용자 목록
   * ------------------------------------------------------------------ */

  async listUsers(query: ListUsersQueryDto): Promise<Paginated<AdminUserRow>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort = query.sort ?? UserSortField.CREATED_AT;
    const order = (query.order ?? 'desc').toUpperCase() as 'ASC' | 'DESC';

    const qb = this.userRepository.createQueryBuilder('user');

    if (query.q) {
      qb.andWhere('user.email ILIKE :q', { q: `%${query.q}%` });
    }
    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('user.is_active = :isActive', { isActive: query.isActive });
    }

    const total = await qb.getCount();

    // completeness와 updatedAt(이력서 기준)은 DB 컬럼이 아니라 계산값이라
    // 페이지 단위로는 정렬할 수 없다. 상한을 두고 메모리에서 정렬한다.
    const needsInMemorySort =
      sort === UserSortField.COMPLETENESS || sort === UserSortField.UPDATED_AT;

    if (needsInMemorySort) {
      const all = await qb
        .orderBy('user.createdAt', 'DESC')
        .take(IN_MEMORY_SORT_CAP)
        .getMany();

      const rows = await this.toUserRows(all);
      rows.sort((a, b) => {
        const diff =
          sort === UserSortField.COMPLETENESS
            ? a.completeness - b.completeness
            : (a.resumeUpdatedAt?.getTime() ?? 0) -
              (b.resumeUpdatedAt?.getTime() ?? 0);
        return order === 'ASC' ? diff : -diff;
      });

      const start = (page - 1) * limit;
      return {
        items: rows.slice(start, start + limit),
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      };
    }

    const column = sort === UserSortField.EMAIL ? 'user.email' : 'user.createdAt';
    const users = await qb
      .orderBy(column, order)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items: await this.toUserRows(users),
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  /** N+1을 피하려고 프로필/이력서를 한 번에 읽어 매핑한다. */
  private async toUserRows(users: User[]): Promise<AdminUserRow[]> {
    if (users.length === 0) return [];

    const ids = users.map((user) => user.id);
    const [profiles, resumes] = await Promise.all([
      this.profileRepository.find({ where: { userId: In(ids) } }),
      this.resumeRepository.find({ where: { userId: In(ids) } }),
    ]);

    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
    const resumeByUser = this.pickLatestResumes(resumes);

    return users.map((user) => {
      const profile = profileByUser.get(user.id) ?? null;
      const resume = resumeByUser.get(user.id) ?? null;

      return {
        id: user.id,
        email: maskEmail(user.email) as string,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        name: maskName(profile?.name ?? null),
        completeness: calculateCompleteness(profile, resume).total,
        hasResume: Boolean(resume),
        resumeUpdatedAt: resume?.updatedAt ?? null,
        masked: true,
      };
    });
  }

  private pickLatestResumes(resumes: Resume[]): Map<string, Resume> {
    const byUser = new Map<string, Resume>();

    for (const resume of resumes) {
      const current = byUser.get(resume.userId);
      if (!current) {
        byUser.set(resume.userId, resume);
        continue;
      }

      // 대표 이력서 우선, 그다음 최근 수정순 — 사용자 화면과 같은 기준
      const better =
        (resume.isPrimary && !current.isPrimary) ||
        (resume.isPrimary === current.isPrimary &&
          resume.updatedAt > current.updatedAt);

      if (better) byUser.set(resume.userId, resume);
    }

    return byUser;
  }

  /* ------------------------------------------------------------------ *
   * 사용자 상세
   * ------------------------------------------------------------------ */

  async getUser(
    id: string,
    reveal: boolean,
    actor: AuthUser,
    ip: string | null,
    reason?: RevealReason,
  ) {
    // 사유 없는 원본 열람은 허용하지 않는다.
    if (reveal && !reason) {
      throw new BadRequestException('개인정보 열람 사유를 선택해 주세요.');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const [profile, resumes] = await Promise.all([
      this.profileRepository.findOne({ where: { userId: id } }),
      this.resumeRepository.find({ where: { userId: id } }),
    ]);

    const resume = this.pickLatestResumes(resumes).get(id) ?? null;
    const completeness = calculateCompleteness(profile, resume);

    if (reveal) {
      await this.writeAudit({
        action: AdminAction.REVEAL_PII,
        actor,
        targetUserId: user.id,
        targetEmail: user.email,
        detail: { fields: ['profile', 'essays'], reason },
        ip,
      });
    }

    return {
      user: {
        id: user.id,
        email: reveal ? user.email : maskEmail(user.email),
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      profile: profile ? this.presentProfile(profile, reveal) : null,
      resume: resume ? this.presentResume(resume, reveal) : null,
      completeness,
      masked: !reveal,
    };
  }

  private presentProfile(profile: Profile, reveal: boolean) {
    return {
      name: reveal ? profile.name : maskName(profile.name),
      phone: reveal ? profile.phone : maskPhone(profile.phone),
      birthdate: reveal ? profile.birthdate : maskBirthdate(profile.birthdate),
      address: reveal ? profile.address : maskAddress(profile.address),
      zipCode: reveal ? profile.zipCode : maskZipCode(profile.zipCode),
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * 학력·경력·자격증은 개인 식별 정보라기보다 이력 자체라 그대로 보여준다.
   * 자기소개서 본문만은 열람 요청이 있을 때만 내려보낸다.
   */
  private presentResume(resume: Resume, reveal: boolean) {
    return {
      id: resume.id,
      title: resume.title,
      headline: resume.headline,
      education: resume.education ?? [],
      careers: resume.careers ?? [],
      certificates: resume.certificates ?? [],
      essays: (resume.essays ?? []).map((essay) => ({
        title: essay.title,
        type: essay.type ?? null,
        charLimit: essay.charLimit ?? null,
        isDefault: essay.isDefault ?? false,
        contentLength: essay.content?.length ?? 0,
        content: reveal ? essay.content : null,
      })),
      skills: resume.skills ?? [],
      updatedAt: resume.updatedAt,
    };
  }

  /* ------------------------------------------------------------------ *
   * 사용자 변경 / 삭제
   * ------------------------------------------------------------------ */

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actor: AuthUser,
    ip: string | null,
  ) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    if (dto.role === undefined && dto.isActive === undefined) {
      throw new BadRequestException('변경할 항목이 없습니다.');
    }

    // 스스로를 잠그면 백오피스에 아무도 들어올 수 없게 된다.
    if (user.id === actor.id) {
      throw new ForbiddenException(
        '자신의 권한이나 활성 상태는 변경할 수 없습니다.',
      );
    }

    if (dto.role !== undefined && dto.role !== user.role) {
      await this.assertNotLastAdmin(user, '마지막 관리자의 권한은 회수할 수 없습니다.');
    }
    if (dto.isActive === false) {
      await this.assertNotLastAdmin(user, '마지막 관리자는 비활성화할 수 없습니다.');
    }

    const before = { role: user.role, isActive: user.isActive };

    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    await this.userRepository.save(user);

    if (dto.role !== undefined && dto.role !== before.role) {
      await this.writeAudit({
        action: AdminAction.UPDATE_ROLE,
        actor,
        targetUserId: user.id,
        targetEmail: user.email,
        detail: { from: before.role, to: user.role },
        ip,
      });
    }
    if (dto.isActive !== undefined && dto.isActive !== before.isActive) {
      await this.writeAudit({
        action: AdminAction.UPDATE_STATUS,
        actor,
        targetUserId: user.id,
        targetEmail: user.email,
        detail: { from: before.isActive, to: user.isActive },
        ip,
      });
    }

    return {
      id: user.id,
      email: maskEmail(user.email),
      role: user.role,
      isActive: user.isActive,
    };
  }

  async deleteUser(id: string, actor: AuthUser, ip: string | null) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    if (user.id === actor.id) {
      throw new ForbiddenException('자신의 계정은 삭제할 수 없습니다.');
    }
    await this.assertNotLastAdmin(user, '마지막 관리자는 삭제할 수 없습니다.');

    // 프로필·이력서는 FK의 ON DELETE CASCADE로 함께 지워진다.
    await this.userRepository.delete(user.id);

    await this.writeAudit({
      action: AdminAction.DELETE_USER,
      actor,
      targetUserId: user.id,
      targetEmail: user.email,
      detail: { role: user.role },
      ip,
    });

    return { id: user.id, deleted: true };
  }

  private async assertNotLastAdmin(user: User, message: string): Promise<void> {
    if (user.role !== UserRole.ADMIN) return;

    const admins = await this.userRepository.count({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    if (admins <= 1) throw new ForbiddenException(message);
  }

  /* ------------------------------------------------------------------ *
   * 감사 로그
   * ------------------------------------------------------------------ */

  async listAuditLogs(
    query: ListAuditLogsQueryDto,
  ): Promise<Paginated<AdminAuditLog>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;

    const [items, total] = await this.auditRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((log) => ({
        ...log,
        actorEmail: maskEmail(log.actorEmail) as string,
        targetEmail: maskEmail(log.targetEmail),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  private async writeAudit(params: {
    action: AdminAction;
    actor: AuthUser;
    targetUserId: string | null;
    targetEmail: string | null;
    detail: Record<string, unknown> | null;
    ip: string | null;
  }): Promise<void> {
    const log = this.auditRepository.create({
      action: params.action,
      actorId: params.actor.id,
      actorEmail: params.actor.email,
      targetUserId: params.targetUserId,
      targetEmail: params.targetEmail,
      detail: params.detail,
      ipAddress: params.ip,
    });

    await this.auditRepository.save(log);
  }
}
