/**
 * 백오피스 기본 표시용 마스킹.
 * 관리자가 사용자를 식별하고 CS에 대응할 수 있을 만큼만 남기고 가린다.
 * 원본은 별도의 열람 요청(reveal)으로만 노출되며, 그 요청은 감사 로그에 남는다.
 */

/** hong@example.com → ho***@example.com */
export function maskEmail(email: string | null): string | null {
  if (!email) return email;

  const [local, domain] = email.split('@');
  if (!domain) return '***';

  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

/** 홍길동 → 홍*동, 김철 → 김*, John Doe → Jo***** */
export function maskName(name: string | null): string | null {
  if (!name) return name;

  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;

  return `${trimmed[0]}${'*'.repeat(trimmed.length - 2)}${trimmed.at(-1)}`;
}

/** 01012345678 → 010-****-5678 */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '*'.repeat(digits.length || 3);

  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 1995-03-02 → 1995-**-** (나이대 파악은 되지만 생일은 가린다) */
export function maskBirthdate(birthdate: string | null): string | null {
  if (!birthdate) return birthdate;
  return `${birthdate.slice(0, 4)}-**-**`;
}

/** 서울시 강남구 테헤란로 123 → 서울시 강남구 *** */
export function maskAddress(address: string | null): string | null {
  if (!address) return address;

  const parts = address.trim().split(/\s+/);
  if (parts.length <= 2) return `${parts[0] ?? ''} ***`.trim();

  return `${parts.slice(0, 2).join(' ')} ***`;
}

/** 06236 → 06*** */
export function maskZipCode(zipCode: string | null): string | null {
  if (!zipCode) return zipCode;
  return `${zipCode.slice(0, 2)}${'*'.repeat(Math.max(zipCode.length - 2, 1))}`;
}

/**
 * 자기소개서 본문은 마스킹이 아니라 아예 내보내지 않는다.
 * 부분 마스킹해도 문맥이 남아 사실상 열람이 되고, 관리자에게 필요한 것은
 * "얼마나 작성했는가"이지 내용 자체가 아니다.
 */
export function summarizeEssayContent(content: string | null): {
  length: number;
  preview: null;
} {
  return { length: content?.length ?? 0, preview: null };
}
