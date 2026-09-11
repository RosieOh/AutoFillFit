import type { ResumeFormValues } from './resume-form';

export type SectionKey = 'profile' | 'history' | 'certificates' | 'essays';

export interface SectionScore {
  key: SectionKey;
  /** 획득 점수 (0 ~ weight) */
  earned: number;
  /** 전체 100점 중 이 섹션의 배점 */
  weight: number;
  /** 다음에 채우면 좋은 항목 — 비어 있으면 완료 */
  nextAction: string | null;
}

export interface Completeness {
  total: number;
  sections: SectionScore[];
  /** 가장 크게 점수를 올릴 수 있는 섹션 */
  weakest: SectionScore | null;
  /** 경력을 배점에서 제외했는지 (신입 선언) */
  careerExcluded: boolean;
}

/** history 40점 중 경력 몫 */
const CAREER_WEIGHT = 20;

const filled = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim() !== '';

/**
 * 이력 완성도.
 * 자동입력이 실제로 채울 수 있는 항목에 가중치를 둔다.
 * 배점을 UI에 그대로 노출하므로(섹션별 표시) 숫자의 근거가 드러나야 한다.
 */
export function calculateCompleteness(values: ResumeFormValues): Completeness {
  /**
   * 신입은 경력이 구조적으로 없어 20점에 영원히 닿지 못한다.
   * "경력 없음"을 선언하면 그 배점을 만점에서 빼고 나머지를 100으로 환산한다.
   */
  const careerExcluded = Boolean(values.noCareer);

  const sections: SectionScore[] = [
    scoreProfile(values),
    scoreHistory(values, careerExcluded),
    scoreCertificates(values),
    scoreEssays(values),
  ];

  const earned = sections.reduce((sum, section) => sum + section.earned, 0);
  const maxScore = careerExcluded ? 100 - CAREER_WEIGHT : 100;
  const total = Math.min(Math.round((earned / maxScore) * 100), 100);

  const incomplete = sections
    .filter((section) => section.earned < section.weight)
    .sort(
      (a, b) => b.weight - b.earned - (a.weight - a.earned),
    );

  return { total, sections, weakest: incomplete[0] ?? null, careerExcluded };
}

function scoreProfile(values: ResumeFormValues): SectionScore {
  const { profile } = values;
  const checks: Array<[boolean, string]> = [
    [filled(profile.name), '이름'],
    [filled(profile.phone), '연락처'],
    [filled(profile.birthdate), '생년월일'],
    [filled(profile.address), '주소'],
    [filled(profile.zipCode), '우편번호'],
  ];

  const weight = 30;
  const unit = weight / checks.length;
  const earned = checks.filter(([ok]) => ok).length * unit;
  const missing = checks.find(([ok]) => !ok);

  return {
    key: 'profile',
    earned,
    weight,
    nextAction: missing ? `${missing[1]}을(를) 입력해 주세요` : null,
  };
}

function scoreHistory(
  values: ResumeFormValues,
  careerExcluded: boolean,
): SectionScore {
  const weight = careerExcluded ? 40 - CAREER_WEIGHT : 40;
  const education = values.education.filter((item) => filled(item.schoolName));
  const careers = values.careers.filter((item) => filled(item.companyName));

  // 학력 20점
  let educationScore = 0;
  if (education.length > 0) {
    const first = education[0];
    educationScore =
      8 +
      (filled(first.major) ? 4 : 0) +
      (filled(first.admissionDate) ? 4 : 0) +
      (filled(first.graduationDate) ? 4 : 0);
  }

  // 경력 20점 — 신입은 경력이 없을 수 있으므로 안내 문구로 구분한다.
  let careerScore = 0;
  if (careers.length > 0) {
    const first = careers[0];
    careerScore =
      8 +
      (filled(first.jobTitle) ? 4 : 0) +
      (filled(first.joinDate) ? 4 : 0) +
      (filled(first.mainTasks) ? 4 : 0);
  }

  let nextAction: string | null = null;
  if (education.length === 0) nextAction = '학력을 추가해 주세요';
  else if (educationScore < 20) nextAction = '학력의 전공·재학 기간을 채워 주세요';
  else if (careerExcluded) nextAction = null;
  else if (careers.length === 0) nextAction = '경력이 있다면 추가해 주세요';
  else if (careerScore < 20) nextAction = '경력의 직무·주요 업무를 채워 주세요';

  return {
    key: 'history',
    // 경력 없음을 선언했으면 경력 점수는 계산에서 빠진다.
    earned: educationScore + (careerExcluded ? 0 : careerScore),
    weight,
    nextAction,
  };
}

function scoreCertificates(values: ResumeFormValues): SectionScore {
  const weight = 10;
  const items = values.certificates.filter((item) => filled(item.name));

  if (items.length === 0) {
    return {
      key: 'certificates',
      earned: 0,
      weight,
      nextAction: '자격증이나 어학 점수를 추가해 주세요',
    };
  }

  const first = items[0];
  const earned =
    6 + (filled(first.issuer) || filled(first.acquiredAt) ? 4 : 0);

  return {
    key: 'certificates',
    earned,
    weight,
    nextAction: earned < weight ? '발급기관 또는 취득일을 입력해 주세요' : null,
  };
}

function scoreEssays(values: ResumeFormValues): SectionScore {
  const weight = 20;
  const items = values.essays.filter(
    (item) => filled(item.title) && filled(item.content),
  );

  if (items.length === 0) {
    return {
      key: 'essays',
      earned: 0,
      weight,
      nextAction: '자주 쓰는 자소서 문항을 등록해 주세요',
    };
  }

  // 문항이 2개 이상이어야 지원서마다 골라 쓸 수 있다.
  const earned = 12 + (items.length >= 2 ? 8 : 0);

  return {
    key: 'essays',
    earned,
    weight,
    nextAction: earned < weight ? '문항을 하나 더 등록해 주세요' : null,
  };
}
