/**
 * Resume 엔티티의 JSONB 컬럼에 저장되는 값의 형태.
 * DB는 스키마를 강제하지 않으므로, 쓰기 경로에서는 반드시
 * dto/resume-json.dto.ts 의 class-validator 규칙으로 검증한다.
 */

/** 학력 — 학교명, 전공, 학점, 입학/졸업년월 */
export interface EducationItem {
  schoolName: string;
  major?: string | null;
  /** 학위 구분 (고등학교/전문학사/학사/석사/박사) */
  degree?: EducationDegree | null;
  /** 졸업 상태 (졸업/재학/휴학/중퇴/졸업예정) */
  status?: EducationStatus | null;
  /** 학점 (예: "3.85") */
  gpa?: string | null;
  /** 학점 만점 기준 (예: "4.50") */
  gpaScale?: string | null;
  /** 입학년월 YYYY-MM */
  admissionDate?: string | null;
  /** 졸업년월 YYYY-MM */
  graduationDate?: string | null;
}

export enum EducationDegree {
  HIGH_SCHOOL = 'HIGH_SCHOOL',
  ASSOCIATE = 'ASSOCIATE',
  BACHELOR = 'BACHELOR',
  MASTER = 'MASTER',
  DOCTOR = 'DOCTOR',
}

export enum EducationStatus {
  GRADUATED = 'GRADUATED',
  ENROLLED = 'ENROLLED',
  LEAVE = 'LEAVE',
  DROPPED = 'DROPPED',
  EXPECTED = 'EXPECTED',
}

/** 경력 — 회사명, 부서, 직무, 입사/퇴사년월, 주요업무 */
export interface CareerItem {
  companyName: string;
  department?: string | null;
  /** 직무 (예: 백엔드 개발) */
  jobTitle?: string | null;
  /** 직급 (예: 선임) */
  position?: string | null;
  /** 입사년월 YYYY-MM */
  joinDate?: string | null;
  /** 퇴사년월 YYYY-MM — 재직 중이면 null */
  leaveDate?: string | null;
  isCurrent?: boolean;
  /** 주요 업무 */
  mainTasks?: string | null;
}

/** 자격증 — 자격증명, 발급기관, 취득일 */
export interface CertificateItem {
  name: string;
  issuer?: string | null;
  /** 취득일 YYYY-MM-DD */
  acquiredAt?: string | null;
  /** 어학 점수 또는 등급 (예: "925", "1급") */
  score?: string | null;
}

/** 자기소개서 문항 유형 — 지원서의 문항을 매칭할 때 힌트로 쓴다. */
export enum EssayType {
  MOTIVATION = 'MOTIVATION',
  GROWTH = 'GROWTH',
  STRENGTH_WEAKNESS = 'STRENGTH_WEAKNESS',
  EXPERIENCE = 'EXPERIENCE',
  ASPIRATION = 'ASPIRATION',
  ETC = 'ETC',
}

/** 자기소개서 — 문항 제목/유형, 답변 내용 */
export interface EssayItem {
  /** 문항 제목 (예: "지원 동기를 작성해 주세요.") */
  title: string;
  type?: EssayType | null;
  /** 답변 내용 */
  content: string;
  /** 문항 글자수 제한 */
  charLimit?: number | null;
  /** 문항 매칭 키워드 (예: ["지원동기", "motivation"]) */
  keywords?: string[] | null;
  /** 문항 매칭 실패 시 사용할 기본 답변 여부 */
  isDefault?: boolean;
}
