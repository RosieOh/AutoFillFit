import { Profile } from '../../users/entities/profile.entity';
import { Resume } from '../../resume/entities/resume.entity';

/**
 * 이력 완성도 — 대시보드(web/lib/completeness.ts)와 같은 배점을 쓴다.
 * 기본 인적사항 30 / 학력·경력 40 / 자격증 10 / 자기소개서 20 = 100
 *
 * 두 곳에 같은 규칙이 존재하므로 배점을 바꾸면 반드시 함께 고쳐야 한다.
 * (프런트는 저장 전 입력까지 즉시 반영해야 해서 서버 값을 그대로 쓸 수 없다.)
 */
export const COMPLETENESS_WEIGHTS = {
  profile: 30,
  history: 40,
  certificates: 10,
  essays: 20,
} as const;

export interface SectionBreakdown {
  profile: number;
  history: number;
  certificates: number;
  essays: number;
}

export interface CompletenessResult {
  total: number;
  sections: SectionBreakdown;
  /** 경력을 배점에서 제외했는지 (신입 선언) */
  careerExcluded: boolean;
}

/** 경력 배점 — history 40점 중 경력 몫 */
const CAREER_WEIGHT = 20;

const filled = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== '';

export function calculateCompleteness(
  profile: Profile | null | undefined,
  resume: Resume | null | undefined,
): CompletenessResult {
  /**
   * 신입은 경력이 구조적으로 없어 20점에 영원히 닿지 못한다.
   * "경력 없음"을 선언하면 그 배점을 만점에서 빼고 나머지를 100으로 환산한다.
   * (사용자가 선언하지 않으면 그냥 미작성으로 본다 — 임의로 추측하지 않는다.)
   */
  const careerExcluded = Boolean(
    (resume?.extra as { noCareer?: boolean } | null)?.noCareer,
  );

  const sections: SectionBreakdown = {
    profile: scoreProfile(profile),
    history: scoreHistory(resume, careerExcluded),
    certificates: scoreCertificates(resume),
    essays: scoreEssays(resume),
  };

  const earned =
    sections.profile +
    sections.history +
    sections.certificates +
    sections.essays;

  const maxScore = careerExcluded ? 100 - CAREER_WEIGHT : 100;
  const total = Math.min(Math.round((earned / maxScore) * 100), 100);

  return { total, sections, careerExcluded };
}

function scoreProfile(profile: Profile | null | undefined): number {
  if (!profile) return 0;

  const checks = [
    filled(profile.name),
    filled(profile.phone),
    filled(profile.birthdate),
    filled(profile.address),
    filled(profile.zipCode),
  ];

  const unit = COMPLETENESS_WEIGHTS.profile / checks.length;
  return checks.filter(Boolean).length * unit;
}

function scoreHistory(
  resume: Resume | null | undefined,
  careerExcluded: boolean,
): number {
  const education = (resume?.education ?? []).filter((item) =>
    filled(item?.schoolName),
  );
  const careers = (resume?.careers ?? []).filter((item) =>
    filled(item?.companyName),
  );

  let score = 0;

  if (education.length > 0) {
    const first = education[0];
    score +=
      8 +
      (filled(first.major) ? 4 : 0) +
      (filled(first.admissionDate) ? 4 : 0) +
      (filled(first.graduationDate) ? 4 : 0);
  }

  // 경력 없음을 선언했으면 경력 점수를 분자에서도 빼야 한다.
  // 분모(maxScore)만 줄이면 같은 이력서가 서버와 클라이언트에서 다른 값이 된다.
  if (!careerExcluded && careers.length > 0) {
    const first = careers[0];
    score +=
      8 +
      (filled(first.jobTitle) ? 4 : 0) +
      (filled(first.joinDate) ? 4 : 0) +
      (filled(first.mainTasks) ? 4 : 0);
  }

  return score;
}

function scoreCertificates(resume: Resume | null | undefined): number {
  const items = (resume?.certificates ?? []).filter((item) =>
    filled(item?.name),
  );
  if (items.length === 0) return 0;

  const first = items[0];
  return 6 + (filled(first.issuer) || filled(first.acquiredAt) ? 4 : 0);
}

function scoreEssays(resume: Resume | null | undefined): number {
  const items = (resume?.essays ?? []).filter(
    (item) => filled(item?.title) && filled(item?.content),
  );
  if (items.length === 0) return 0;

  return 12 + (items.length >= 2 ? 8 : 0);
}
