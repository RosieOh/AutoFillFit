/**
 * Nest.js 백엔드 DTO와 1:1로 대응하는 타입 정의.
 * 서버(server/src/resume/types/resume-json.types.ts)의 enum 값과 문자열이 같아야 한다.
 */

export type EducationDegree =
  | 'HIGH_SCHOOL'
  | 'ASSOCIATE'
  | 'BACHELOR'
  | 'MASTER'
  | 'DOCTOR';

export type EducationStatus =
  | 'GRADUATED'
  | 'ENROLLED'
  | 'LEAVE'
  | 'DROPPED'
  | 'EXPECTED';

export type EssayType =
  | 'MOTIVATION'
  | 'GROWTH'
  | 'STRENGTH_WEAKNESS'
  | 'EXPERIENCE'
  | 'ASPIRATION'
  | 'ETC';

export const EDUCATION_DEGREE_LABELS: Record<EducationDegree, string> = {
  HIGH_SCHOOL: '고등학교',
  ASSOCIATE: '전문학사',
  BACHELOR: '학사',
  MASTER: '석사',
  DOCTOR: '박사',
};

export const EDUCATION_STATUS_LABELS: Record<EducationStatus, string> = {
  GRADUATED: '졸업',
  ENROLLED: '재학',
  LEAVE: '휴학',
  DROPPED: '중퇴',
  EXPECTED: '졸업예정',
};

export const ESSAY_TYPE_LABELS: Record<EssayType, string> = {
  MOTIVATION: '지원동기',
  GROWTH: '성장과정',
  STRENGTH_WEAKNESS: '장단점',
  EXPERIENCE: '경험/역량',
  ASPIRATION: '입사 후 포부',
  ETC: '기타',
};

/** 학력 — 학교명, 전공, 학점, 입학/졸업년월 */
export interface EducationItem {
  schoolName: string;
  major?: string | null;
  degree?: EducationDegree | null;
  status?: EducationStatus | null;
  /** 예: "3.85" */
  gpa?: string | null;
  /** 예: "4.50" */
  gpaScale?: string | null;
  /** YYYY-MM */
  admissionDate?: string | null;
  /** YYYY-MM */
  graduationDate?: string | null;
}

/** 경력 — 회사명, 부서, 직무, 입사/퇴사년월, 주요업무 */
export interface CareerItem {
  companyName: string;
  department?: string | null;
  jobTitle?: string | null;
  position?: string | null;
  /** YYYY-MM */
  joinDate?: string | null;
  /** YYYY-MM — 재직 중이면 비워 둔다 */
  leaveDate?: string | null;
  isCurrent?: boolean;
  mainTasks?: string | null;
}

/** 자격증 — 자격증명, 발급기관, 취득일 */
export interface CertificateItem {
  name: string;
  issuer?: string | null;
  /** YYYY-MM-DD */
  acquiredAt?: string | null;
  score?: string | null;
}

/** 자기소개서 — 문항 제목/유형, 답변 내용 */
export interface EssayItem {
  title: string;
  type?: EssayType | null;
  content: string;
  charLimit?: number | null;
  keywords?: string[] | null;
  isDefault?: boolean;
}

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  /** YYYY-MM-DD */
  birthdate: string | null;
  address: string | null;
  zipCode: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  title: string;
  isPrimary: boolean;
  headline: string | null;
  education: EducationItem[];
  careers: CareerItem[];
  certificates: CertificateItem[];
  essays: EssayItem[];
  skills: string[] | null;
  extra: Record<string, unknown> | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** 확장이 지원서에 넣을 학력 한 건 (최종학력이 첫 항목) */
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

/** 확장이 지원서에 넣을 경력 한 건 (재직 중인 곳이 첫 항목) */
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

/** 확장이 지원서에 넣을 자격증 한 건 (취득일 최신순) */
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

/** GET /api/resume/my */
export interface MyResumeResponse {
  user: { id: string; email: string };
  profile: Profile | null;
  resume: Resume | null;
  /** Chrome Extension이 그대로 쓰는 평탄화 값 */
  autofill: {
    name: string | null;
    email: string;
    phone: string | null;
    birthdate: string | null;
    address: string | null;
    zipCode: string | null;
    /** 문항을 찾지 못했을 때 쓰는 단일 fallback */
    coverLetter: string | null;
    /** 확장이 지원서 문항과 대조해 칸마다 다른 답변을 넣는다 */
    essays: AutofillEssay[];
    /** 학력·경력·자격증. 전부 최신순 — 지원서가 한 칸만 받으면 첫 항목을 쓴다 */
    education: AutofillEducation[];
    careers: AutofillCareer[];
    certificates: AutofillCertificate[];
  };
  updatedAt: string | null;
}

export interface UpsertProfilePayload {
  name?: string;
  phone?: string;
  birthdate?: string;
  address?: string;
  zipCode?: string;
}

/**
 * PATCH /api/resume/my 요청 본문.
 * 서버가 forbidNonWhitelisted로 동작하므로 여기 정의되지 않은 키를 보내면 400이다.
 */
export interface UpsertMyResumePayload {
  profile?: UpsertProfilePayload;
  title?: string;
  headline?: string;
  education?: EducationItem[];
  careers?: CareerItem[];
  certificates?: CertificateItem[];
  essays?: EssayItem[];
  skills?: string[];
  extra?: Record<string, unknown>;
}

/** POST /auth/login, POST /auth/signup 응답 */
export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: { id: string; email: string; role: 'USER' | 'ADMIN'; createdAt: string };
}
