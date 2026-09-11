import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  toFormValues,
  toUpsertPayload,
  type ResumeFormValues,
} from '@/lib/resume-form';
import type { MyResumeResponse } from '@/types/resume';

/**
 * 서버의 @Matches / @IsDateString은 ""를 형식 위반으로 거부한다
 * (@IsOptional은 undefined만 건너뛴다). 빈 문자열을 그대로 보내면
 * 생년월일 하나만 비워도 저장 전체가 400으로 실패한다.
 */

const filled = (): ResumeFormValues => ({
  ...EMPTY_FORM,
  profile: {
    name: '홍길동',
    phone: '010-1234-5678',
    birthdate: '1995-03-02',
    address: '서울시 강남구',
    zipCode: '06236',
  },
});

describe('toUpsertPayload — 빈 값 처리', () => {
  it('빈 문자열은 키 자체를 보내지 않는다', () => {
    const payload = toUpsertPayload({
      ...filled(),
      profile: { ...filled().profile, birthdate: '', zipCode: '' },
    });

    expect(payload.profile).not.toHaveProperty('birthdate');
    expect(payload.profile).not.toHaveProperty('zipCode');
    expect(payload.profile?.name).toBe('홍길동');
  });

  it('전부 비면 빈 객체를 보낸다 (null이 아니라)', () => {
    const payload = toUpsertPayload(EMPTY_FORM);
    expect(payload.profile).toEqual({});
  });

  it('식별 값이 빈 행은 통째로 제외한다', () => {
    const payload = toUpsertPayload({
      ...filled(),
      education: [
        { ...EMPTY_FORM.education[0], schoolName: '' } as never,
        {
          schoolName: '한국대학교',
          major: '',
          degree: 'BACHELOR',
          status: 'GRADUATED',
          gpa: '',
          gpaScale: '',
          admissionDate: '',
          graduationDate: '',
        },
      ],
    });

    expect(payload.education).toHaveLength(1);
    expect(payload.education?.[0].schoolName).toBe('한국대학교');
    // 빈 값들은 키째 빠져야 한다
    expect(payload.education?.[0]).not.toHaveProperty('major');
    expect(payload.education?.[0]).not.toHaveProperty('admissionDate');
  });

  it('제목이나 본문이 빈 자소서 문항은 보내지 않는다', () => {
    const payload = toUpsertPayload({
      ...filled(),
      essays: [
        { title: '제목만', type: '', content: '', charLimit: '', keywords: '', isDefault: false },
        { title: '', type: '', content: '본문만', charLimit: '', keywords: '', isDefault: false },
        { title: '지원 동기', type: 'MOTIVATION', content: '내용', charLimit: '1000', keywords: '', isDefault: true },
      ],
    });

    expect(payload.essays).toHaveLength(1);
    expect(payload.essays?.[0].title).toBe('지원 동기');
    expect(payload.essays?.[0].charLimit).toBe(1000);
  });

  it('글자수 제한이 비면 숫자로 만들지 않는다', () => {
    const payload = toUpsertPayload({
      ...filled(),
      essays: [{ title: 'a', type: '', content: 'b', charLimit: '', keywords: '', isDefault: false }],
    });

    expect(payload.essays?.[0]).not.toHaveProperty('charLimit');
  });

  it('재직 중이면 퇴사 연월을 보내지 않는다', () => {
    const payload = toUpsertPayload({
      ...filled(),
      careers: [
        {
          companyName: '로지소프트',
          department: '',
          jobTitle: '백엔드',
          position: '',
          joinDate: '2020-01',
          leaveDate: '2023-12',
          isCurrent: true,
          mainTasks: '',
        },
      ],
    });

    expect(payload.careers?.[0].isCurrent).toBe(true);
    expect(payload.careers?.[0]).not.toHaveProperty('leaveDate');
  });

  it('퇴사했으면 퇴사 연월을 보낸다', () => {
    const payload = toUpsertPayload({
      ...filled(),
      careers: [
        {
          companyName: '로지소프트',
          department: '',
          jobTitle: '',
          position: '',
          joinDate: '2020-01',
          leaveDate: '2023-12',
          isCurrent: false,
          mainTasks: '',
        },
      ],
    });

    expect(payload.careers?.[0].leaveDate).toBe('2023-12');
  });

  it('신입 선언은 extra로 나간다', () => {
    expect(toUpsertPayload({ ...filled(), noCareer: true }).extra).toEqual({
      noCareer: true,
    });
    expect(toUpsertPayload(filled()).extra).toEqual({ noCareer: false });
  });
});

describe('toFormValues — 서버 응답을 폼으로', () => {
  const response = (over: Partial<MyResumeResponse> = {}): MyResumeResponse =>
    ({
      user: { id: 'u1', email: 'hong@example.com' },
      profile: null,
      resume: null,
      autofill: {
        name: null,
        email: 'hong@example.com',
        phone: null,
        birthdate: null,
        address: null,
        zipCode: null,
        coverLetter: null,
      },
      updatedAt: null,
      ...over,
    }) as MyResumeResponse;

  it('null을 빈 문자열로 바꾼다 — input이 uncontrolled가 되면 React가 경고한다', () => {
    const values = toFormValues(response());

    expect(values.profile.name).toBe('');
    expect(values.profile.phone).toBe('');
    expect(values.education).toEqual([]);
  });

  it('extra.noCareer를 폼 값으로 되돌린다', () => {
    const values = toFormValues(
      response({
        resume: {
          education: [],
          careers: [],
          certificates: [],
          essays: [],
          extra: { noCareer: true },
        } as never,
      }),
    );

    expect(values.noCareer).toBe(true);
  });

  it('extra가 없으면 false', () => {
    const values = toFormValues(
      response({
        resume: {
          education: [],
          careers: [],
          certificates: [],
          essays: [],
          extra: null,
        } as never,
      }),
    );

    expect(values.noCareer).toBe(false);
  });

  it('왕복해도 값이 유지된다', () => {
    const payload = toUpsertPayload(filled());
    expect(payload.profile?.phone).toBe('010-1234-5678');
  });
});
