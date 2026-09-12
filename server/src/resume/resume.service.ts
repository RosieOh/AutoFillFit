import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Profile } from '../users/entities/profile.entity';
import { User } from '../users/entities/user.entity';
import { UpsertProfileDto, UpsertMyResumeDto } from './dto/upsert-my-resume.dto';
import { Resume } from './entities/resume.entity';
import {
  CareerItem,
  CertificateItem,
  EducationDegree,
  EducationItem,
  EducationStatus,
  EssayItem,
  EssayType,
} from './types/resume-json.types';

/**
 * 확장이 지원서에 넣을 학력 한 건.
 *
 * 한국 지원서는 보통 '최종학력' 한 줄만 받으므로 최신순으로 내려준다.
 * null 자리를 undefined로 두면 확장이 in 연산으로 존재 여부를 판단할 때 어긋난다.
 */
export interface AutofillEducation {
  schoolName: string;
  major: string | null;
  degree: EducationDegree | null;
  status: EducationStatus | null;
  gpa: string | null;
  gpaScale: string | null;
  admissionDate: string | null;
  graduationDate: string | null;
}

/** 확장이 지원서에 넣을 경력 한 건. 최신순. */
export interface AutofillCareer {
  companyName: string;
  department: string | null;
  jobTitle: string | null;
  position: string | null;
  joinDate: string | null;
  leaveDate: string | null;
  isCurrent: boolean;
  mainTasks: string | null;
}

/** 확장이 지원서에 넣을 자격증 한 건. 취득일 최신순. */
export interface AutofillCertificate {
  name: string;
  issuer: string | null;
  acquiredAt: string | null;
  score: string | null;
}

/** 확장이 문항 매칭에 쓰는 자소서 한 건 */
export interface AutofillEssay {
  title: string;
  type: EssayType | null;
  keywords: string[];
  charLimit: number | null;
  isDefault: boolean;
  content: string;
}

/** Chrome Extension이 그대로 사용할 수 있도록 평탄화한 응답 */
export interface MyResumeResponse {
  user: { id: string; email: string };
  profile: Profile | null;
  resume: Resume | null;
  /** content.js의 profile 객체와 키가 1:1로 대응된다. */
  autofill: {
    name: string | null;
    email: string;
    phone: string | null;
    birthdate: string | null;
    address: string | null;
    zipCode: string | null;
    /**
     * 문항을 찾지 못했을 때 쓰는 단일 fallback.
     * 확장 구버전 호환을 위해 유지한다.
     */
    coverLetter: string | null;
    /**
     * 자소서 문항 전체.
     * 확장이 지원서의 문항과 대조해 칸마다 다른 답변을 넣는다.
     * 이걸 내려보내지 않으면 모든 장문 칸에 같은 글이 들어간다.
     */
    essays: AutofillEssay[];
    /**
     * 학력·경력·자격증.
     *
     * 대시보드는 이 세 섹션에 70점을 배정하는데 확장에 전달되지 않으면
     * 사용자가 채운 내용이 지원서에 한 글자도 들어가지 않는다.
     * 전부 최신순이고, 지원서가 한 칸만 받으면 확장이 첫 항목을 쓴다.
     */
    education: AutofillEducation[];
    careers: AutofillCareer[];
    certificates: AutofillCertificate[];
  };
  updatedAt: Date | null;
}

@Injectable()
export class ResumeService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * GET /api/resume/my
   * 로그인한 유저의 프로필 + 최신(대표) 이력서 전체를 반환한다.
   */
  async findMy(userId: string): Promise<MyResumeResponse> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const [profile, resume] = await Promise.all([
      this.profileRepository.findOne({ where: { userId } }),
      this.findLatestResume(userId),
    ]);

    return {
      user,
      profile: profile ?? null,
      resume: resume ?? null,
      autofill: {
        name: profile?.name ?? null,
        email: user.email,
        phone: profile?.phone ?? null,
        birthdate: profile?.birthdate ?? null,
        address: profile?.address ?? null,
        zipCode: profile?.zipCode ?? null,
        coverLetter: this.pickDefaultEssay(resume),
        essays: this.toAutofillEssays(resume),
        education: this.toAutofillEducation(resume),
        careers: this.toAutofillCareers(resume),
        certificates: this.toAutofillCertificates(resume),
      },
      updatedAt: resume?.updatedAt ?? profile?.updatedAt ?? null,
    };
  }

  /**
   * PATCH /api/resume/my
   * 프로필과 이력서를 한 트랜잭션으로 Upsert 한다.
   * 레코드가 없으면 생성하고, 있으면 본문에 포함된 필드만 수정한다.
   */
  async upsertMy(
    userId: string,
    dto: UpsertMyResumeDto,
  ): Promise<MyResumeResponse> {
    const userExists = await this.userRepository.exists({
      where: { id: userId },
    });

    if (!userExists) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    await this.dataSource.transaction(async (manager) => {
      if (dto.profile) {
        await this.upsertProfile(manager, userId, dto.profile);
      }
      await this.upsertResume(manager, userId, dto);
    });

    return this.findMy(userId);
  }

  /* ------------------------------------------------------------------ *
   * 내부 헬퍼
   * ------------------------------------------------------------------ */

  /** 대표 이력서 우선, 그다음 최근 수정순 */
  private findLatestResume(userId: string): Promise<Resume | null> {
    return this.resumeRepository.findOne({
      where: { userId },
      order: { isPrimary: 'DESC', updatedAt: 'DESC' },
    });
  }

  private async upsertProfile(
    manager: EntityManager,
    userId: string,
    dto: UpsertProfileDto,
  ): Promise<void> {
    const profile =
      (await manager.findOne(Profile, { where: { userId } })) ??
      manager.create(Profile, { userId });

    if (dto.name !== undefined) profile.name = dto.name;
    // 사이트마다 하이픈 유무가 달라 숫자만 남겨 저장한다.
    if (dto.phone !== undefined) {
      profile.phone = dto.phone.replace(/[^0-9+]/g, '');
    }
    if (dto.birthdate !== undefined) profile.birthdate = dto.birthdate;
    if (dto.address !== undefined) profile.address = dto.address;
    if (dto.zipCode !== undefined) profile.zipCode = dto.zipCode;

    await manager.save(Profile, profile);
  }

  private async upsertResume(
    manager: EntityManager,
    userId: string,
    dto: UpsertMyResumeDto,
  ): Promise<void> {
    let resume = await manager.findOne(Resume, {
      where: { userId },
      order: { isPrimary: 'DESC', updatedAt: 'DESC' },
    });

    if (!resume) {
      resume = manager.create(Resume, {
        userId,
        title: dto.title ?? '기본 이력서',
        isPrimary: true,
        education: [],
        careers: [],
        certificates: [],
        essays: [],
      });
    }

    if (dto.title !== undefined) resume.title = dto.title;
    if (dto.headline !== undefined) resume.headline = dto.headline;
    if (dto.skills !== undefined) resume.skills = dto.skills;

    // JSONB 배열은 지정된 것만 통째로 교체한다.
    if (dto.education !== undefined) resume.education = dto.education;
    if (dto.careers !== undefined) resume.careers = dto.careers;
    if (dto.certificates !== undefined) resume.certificates = dto.certificates;
    if (dto.essays !== undefined) resume.essays = dto.essays;

    // extra는 사이트별 부가 항목이 계속 쌓이는 곳이라 얕게 병합한다.
    if (dto.extra !== undefined) {
      resume.extra = { ...(resume.extra ?? {}), ...dto.extra };
    }

    await manager.save(Resume, resume);
  }

  /**
   * 확장이 문항별로 매칭할 수 있도록 자소서를 그대로 넘긴다.
   * 제목·유형·키워드가 매칭의 재료이고, 글자수 제한은 넘치는 답변을
   * 잘린 채 제출되지 않게 막는 데 쓰인다.
   */
  private toAutofillEssays(resume: Resume | null): AutofillEssay[] {
    return (resume?.essays ?? [])
      .filter((essay) => essay?.title?.trim() && essay?.content?.trim())
      .map((essay) => ({
        title: essay.title,
        type: essay.type ?? null,
        keywords: essay.keywords ?? [],
        charLimit: essay.charLimit ?? null,
        isDefault: essay.isDefault ?? false,
        content: essay.content,
      }));
  }

  /**
   * 최신순 정렬 키.
   *
   * 날짜는 "YYYY-MM" 또는 "YYYY-MM-DD" 문자열이라 사전순이 곧 시간순이다.
   * 비어 있으면 가장 오래된 것으로 보내 최신 항목이 앞에 오게 한다.
   */
  private recencyKey(value?: string | null): string {
    return value?.trim() ? value : '';
  }

  /** 최종학력이 먼저 오도록 졸업년월 내림차순. */
  private toAutofillEducation(resume: Resume | null): AutofillEducation[] {
    return (resume?.education ?? [])
      .filter((item): item is EducationItem => Boolean(item?.schoolName?.trim()))
      .slice()
      .sort(
        (a, b) =>
          this.recencyKey(b.graduationDate ?? b.admissionDate).localeCompare(
            this.recencyKey(a.graduationDate ?? a.admissionDate),
          ),
      )
      .map((item) => ({
        schoolName: item.schoolName,
        major: item.major ?? null,
        degree: item.degree ?? null,
        status: item.status ?? null,
        gpa: item.gpa ?? null,
        gpaScale: item.gpaScale ?? null,
        admissionDate: item.admissionDate ?? null,
        graduationDate: item.graduationDate ?? null,
      }));
  }

  /** 재직 중인 회사가 먼저, 그다음 입사년월 내림차순. */
  private toAutofillCareers(resume: Resume | null): AutofillCareer[] {
    return (resume?.careers ?? [])
      .filter((item): item is CareerItem => Boolean(item?.companyName?.trim()))
      .slice()
      .sort((a, b) => {
        if (Boolean(a.isCurrent) !== Boolean(b.isCurrent)) {
          return a.isCurrent ? -1 : 1;
        }
        return this.recencyKey(b.joinDate).localeCompare(this.recencyKey(a.joinDate));
      })
      .map((item) => ({
        companyName: item.companyName,
        department: item.department ?? null,
        jobTitle: item.jobTitle ?? null,
        position: item.position ?? null,
        joinDate: item.joinDate ?? null,
        // 재직 중이면 퇴사년월을 내려보내지 않는다. 지원서에 들어가면 거짓이 된다.
        leaveDate: item.isCurrent ? null : (item.leaveDate ?? null),
        isCurrent: item.isCurrent ?? false,
        mainTasks: item.mainTasks ?? null,
      }));
  }

  /** 취득일 내림차순. */
  private toAutofillCertificates(resume: Resume | null): AutofillCertificate[] {
    return (resume?.certificates ?? [])
      .filter((item): item is CertificateItem => Boolean(item?.name?.trim()))
      .slice()
      .sort((a, b) =>
        this.recencyKey(b.acquiredAt).localeCompare(this.recencyKey(a.acquiredAt)),
      )
      .map((item) => ({
        name: item.name,
        issuer: item.issuer ?? null,
        acquiredAt: item.acquiredAt ?? null,
        score: item.score ?? null,
      }));
  }

  /**
   * 문항을 찾지 못했을 때 쓸 단일 fallback.
   * isDefault → 지원동기(MOTIVATION) → 첫 번째 문항 순으로 우선한다.
   */
  private pickDefaultEssay(resume: Resume | null): string | null {
    const essays: EssayItem[] = resume?.essays ?? [];
    if (essays.length === 0) return null;

    const preferred =
      essays.find((essay) => essay.isDefault) ??
      essays.find((essay) => essay.type === EssayType.MOTIVATION) ??
      essays[0];

    return preferred?.content ?? null;
  }
}
