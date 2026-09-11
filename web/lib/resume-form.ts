import type {
  CareerItem,
  CertificateItem,
  EducationDegree,
  EducationItem,
  EducationStatus,
  EssayItem,
  EssayType,
  MyResumeResponse,
  UpsertMyResumePayload,
  UpsertProfilePayload,
} from '@/types/resume';

/**
 * 폼 내부 값은 전부 문자열로 다룬다.
 * null을 그대로 쓰면 input이 uncontrolled로 바뀌며 React 경고가 발생한다.
 */
export interface ProfileFormValues {
  name: string;
  phone: string;
  birthdate: string;
  address: string;
  zipCode: string;
}

export interface EducationFormValues {
  schoolName: string;
  major: string;
  degree: EducationDegree | '';
  status: EducationStatus | '';
  gpa: string;
  gpaScale: string;
  admissionDate: string;
  graduationDate: string;
}

export interface CareerFormValues {
  companyName: string;
  department: string;
  jobTitle: string;
  position: string;
  joinDate: string;
  leaveDate: string;
  isCurrent: boolean;
  mainTasks: string;
}

export interface CertificateFormValues {
  name: string;
  issuer: string;
  acquiredAt: string;
  score: string;
}

export interface EssayFormValues {
  title: string;
  type: EssayType | '';
  content: string;
  charLimit: string;
  /**
   * 문항 매칭 키워드. 쉼표로 구분해 입력한다.
   * 폼에 없으면 저장할 때마다 서버의 값이 지워진다(배열을 통째로 교체하므로).
   */
  keywords: string;
  isDefault: boolean;
}

export interface ResumeFormValues {
  profile: ProfileFormValues;
  education: EducationFormValues[];
  careers: CareerFormValues[];
  certificates: CertificateFormValues[];
  essays: EssayFormValues[];
  /**
   * 신입이라 경력이 없음을 선언한 상태.
   * 서버에는 resume.extra.noCareer로 저장된다.
   */
  noCareer: boolean;
}

export const EMPTY_EDUCATION: EducationFormValues = {
  schoolName: '',
  major: '',
  degree: 'BACHELOR',
  status: 'GRADUATED',
  gpa: '',
  gpaScale: '4.50',
  admissionDate: '',
  graduationDate: '',
};

export const EMPTY_CAREER: CareerFormValues = {
  companyName: '',
  department: '',
  jobTitle: '',
  position: '',
  joinDate: '',
  leaveDate: '',
  isCurrent: false,
  mainTasks: '',
};

export const EMPTY_CERTIFICATE: CertificateFormValues = {
  name: '',
  issuer: '',
  acquiredAt: '',
  score: '',
};

export const EMPTY_ESSAY: EssayFormValues = {
  title: '',
  type: 'MOTIVATION',
  content: '',
  charLimit: '',
  keywords: '',
  isDefault: false,
};

export const EMPTY_FORM: ResumeFormValues = {
  profile: { name: '', phone: '', birthdate: '', address: '', zipCode: '' },
  education: [],
  careers: [],
  certificates: [],
  essays: [],
  noCareer: false,
};

const str = (value: string | null | undefined): string => value ?? '';

/** GET 응답 → 폼 값 */
export function toFormValues(data: MyResumeResponse): ResumeFormValues {
  const { profile, resume } = data;

  return {
    profile: {
      name: str(profile?.name),
      phone: str(profile?.phone),
      birthdate: str(profile?.birthdate),
      address: str(profile?.address),
      zipCode: str(profile?.zipCode),
    },
    education: (resume?.education ?? []).map((item) => ({
      schoolName: str(item.schoolName),
      major: str(item.major),
      degree: item.degree ?? '',
      status: item.status ?? '',
      gpa: str(item.gpa),
      gpaScale: str(item.gpaScale),
      admissionDate: str(item.admissionDate),
      graduationDate: str(item.graduationDate),
    })),
    careers: (resume?.careers ?? []).map((item) => ({
      companyName: str(item.companyName),
      department: str(item.department),
      jobTitle: str(item.jobTitle),
      position: str(item.position),
      joinDate: str(item.joinDate),
      leaveDate: str(item.leaveDate),
      isCurrent: item.isCurrent ?? false,
      mainTasks: str(item.mainTasks),
    })),
    certificates: (resume?.certificates ?? []).map((item) => ({
      name: str(item.name),
      issuer: str(item.issuer),
      acquiredAt: str(item.acquiredAt),
      score: str(item.score),
    })),
    essays: (resume?.essays ?? []).map((item) => ({
      title: str(item.title),
      type: item.type ?? '',
      content: str(item.content),
      charLimit: item.charLimit != null ? String(item.charLimit) : '',
      keywords: (item.keywords ?? []).join(', '),
      isDefault: item.isDefault ?? false,
    })),
    noCareer: Boolean(
      (resume?.extra as { noCareer?: boolean } | null)?.noCareer,
    ),
  };
}

/**
 * 빈 문자열은 키 자체를 빼서 보낸다.
 * 서버의 @Matches / @IsDateString이 ""를 형식 위반으로 거부하기 때문이다.
 * (@IsOptional은 undefined만 통과시키고 ""는 검증 대상으로 본다.)
 */
function omitEmpty<TResult>(source: object): TResult {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === '' || value === undefined || value === null) continue;
    result[key] = value;
  }
  return result as TResult;
}

/**
 * 폼 값 → PATCH /api/resume/my 본문.
 * 이름/회사명/제목처럼 항목을 식별하는 값이 비어 있는 행은 통째로 제외한다.
 */
export function toUpsertPayload(
  values: ResumeFormValues,
): UpsertMyResumePayload {
  const profile = omitEmpty<UpsertProfilePayload>(values.profile);

  const education = values.education
    .filter((item) => item.schoolName.trim() !== '')
    .map((item) => omitEmpty<EducationItem>(item));

  const careers = values.careers
    .filter((item) => item.companyName.trim() !== '')
    .map((item) => {
      // 재직 중이면 퇴사년월을 보내지 않는다.
      const { leaveDate, isCurrent, ...rest } = item;
      return {
        ...omitEmpty<CareerItem>(rest),
        isCurrent,
        ...(isCurrent || leaveDate === '' ? {} : { leaveDate }),
      };
    });

  const certificates = values.certificates
    .filter((item) => item.name.trim() !== '')
    .map((item) => omitEmpty<CertificateItem>(item));

  const essays = values.essays
    .filter((item) => item.title.trim() !== '' && item.content.trim() !== '')
    .map((item) => {
      const { charLimit, keywords, isDefault, ...rest } = item;
      const parsedLimit = Number.parseInt(charLimit, 10);
      const parsedKeywords = keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean);

      return {
        ...omitEmpty<EssayItem>(rest),
        isDefault,
        ...(Number.isFinite(parsedLimit) && parsedLimit > 0
          ? { charLimit: parsedLimit }
          : {}),
        ...(parsedKeywords.length > 0 ? { keywords: parsedKeywords } : {}),
      };
    });

  return {
    profile,
    education,
    careers,
    certificates,
    essays,
    // extra는 서버에서 얕게 병합되므로 이 키만 보낸다.
    extra: { noCareer: values.noCareer },
  };
}
