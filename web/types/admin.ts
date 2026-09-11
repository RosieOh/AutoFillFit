import type {
  CareerItem,
  CertificateItem,
  EducationItem,
  EssayType,
} from './resume';

export type UserRole = 'USER' | 'ADMIN';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  USER: '일반',
  ADMIN: '관리자',
};

export type AdminAction =
  | 'REVEAL_PII'
  | 'UPDATE_ROLE'
  | 'UPDATE_STATUS'
  | 'DELETE_USER';

export const ADMIN_ACTION_LABELS: Record<AdminAction, string> = {
  REVEAL_PII: '개인정보 열람',
  UPDATE_ROLE: '권한 변경',
  UPDATE_STATUS: '상태 변경',
  DELETE_USER: '계정 삭제',
};

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SectionBreakdown {
  profile: number;
  history: number;
  certificates: number;
  essays: number;
}

/** GET /admin/stats */
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
    distribution: { bucket: string; count: number }[];
    sectionAverages: SectionBreakdown;
    sectionWeights: SectionBreakdown;
  };
  signupTrend: { date: string; count: number }[];
}

/** GET /admin/users */
export interface AdminUserRow {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  name: string | null;
  completeness: number;
  hasResume: boolean;
  resumeUpdatedAt: string | null;
  masked: boolean;
}

/** GET /admin/users/:id */
export interface AdminUserDetail {
  user: {
    id: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
  };
  profile: {
    name: string | null;
    phone: string | null;
    birthdate: string | null;
    address: string | null;
    zipCode: string | null;
    updatedAt: string;
  } | null;
  resume: {
    id: string;
    title: string;
    headline: string | null;
    education: EducationItem[];
    careers: CareerItem[];
    certificates: CertificateItem[];
    essays: {
      title: string;
      type: EssayType | null;
      charLimit: number | null;
      isDefault: boolean;
      contentLength: number;
      /** 열람 요청(reveal) 없이는 항상 null */
      content: string | null;
    }[];
    skills: string[];
    updatedAt: string;
  } | null;
  completeness: {
    total: number;
    sections: SectionBreakdown;
    /** 경력을 배점에서 제외했는지 (신입 선언) */
    careerExcluded: boolean;
  };
  masked: boolean;
}

/** GET /admin/audit-logs */
export interface AdminAuditLog {
  id: string;
  action: AdminAction;
  actorId: string | null;
  actorEmail: string;
  targetUserId: string | null;
  targetEmail: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

/** GET /auth/me */
export interface MeResponse {
  id: string;
  email: string;
  role: UserRole;
}
