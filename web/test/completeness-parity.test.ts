import { describe, expect, it } from 'vitest';
import { calculateCompleteness as webCalc } from '@/lib/completeness';
import { calculateCompleteness as mobileCalc } from '../../mobile/src/lib/completeness';
import { EMPTY_FORM, type ResumeFormValues } from '@/lib/resume-form';

/**
 * 완성도 규칙은 server / web / mobile 세 곳에 복사돼 있다.
 * 실제로 어긋난 적이 있다 — 서버가 careerExcluded를 scoreHistory에 넘기지 않아
 * 같은 이력서에 대해 관리자 화면과 사용자 화면이 최대 25%p 달랐다.
 *
 * 이 파일은 web과 mobile 구현이 한 글자도 어긋나지 않도록 고정한다.
 * (서버는 TypeORM 엔티티를 받으므로 형태가 달라 별도 spec에서 검증한다.)
 */

const form = (over: Partial<ResumeFormValues> = {}): ResumeFormValues => ({
  ...EMPTY_FORM,
  profile: {
    name: '홍길동',
    phone: '01012345678',
    birthdate: '1995-03-02',
    address: '서울시 강남구 테헤란로 123',
    zipCode: '06236',
  },
  education: [
    {
      schoolName: '한국대학교',
      major: '컴퓨터공학',
      degree: 'BACHELOR',
      status: 'GRADUATED',
      gpa: '3.85',
      gpaScale: '4.50',
      admissionDate: '2014-03',
      graduationDate: '2018-02',
    },
  ],
  careers: [
    {
      companyName: '로지소프트',
      department: '플랫폼팀',
      jobTitle: '백엔드 개발',
      position: '주임',
      joinDate: '2020-01',
      leaveDate: '',
      isCurrent: true,
      mainTasks: '결제 API',
    },
  ],
  certificates: [
    { name: '정보처리기사', issuer: '한국산업인력공단', acquiredAt: '', score: '' },
  ],
  essays: [
    { title: '지원 동기', type: 'MOTIVATION', content: 'a', charLimit: '', keywords: '', isDefault: true },
    { title: '성장 과정', type: 'GROWTH', content: 'b', charLimit: '', keywords: '', isDefault: false },
  ],
  ...over,
});

const CASES: Array<[string, ResumeFormValues]> = [
  ['빈 이력서', EMPTY_FORM],
  ['완성된 이력서', form()],
  ['경력 없음(미선언)', form({ careers: [] })],
  ['경력 없음(신입 선언)', form({ careers: [], noCareer: true })],
  ['신입 선언인데 경력이 남아 있음', form({ noCareer: true })],
  ['인적사항 일부만', form({ profile: { ...form().profile, address: '', zipCode: '' } })],
  ['자소서 1건', form({ essays: [form().essays[0]] })],
  ['자격증 없음', form({ certificates: [] })],
];

describe('web ↔ mobile 완성도 규칙 일치', () => {
  it.each(CASES)('%s — 총점과 섹션 점수가 같다', (_label, values) => {
    const web = webCalc(values);
    const mobile = mobileCalc(values);

    expect(mobile.total).toBe(web.total);
    expect(mobile.careerExcluded).toBe(web.careerExcluded);
    expect(mobile.sections.map((s) => [s.key, s.earned, s.weight])).toEqual(
      web.sections.map((s) => [s.key, s.earned, s.weight]),
    );
  });
});

describe('신입 선언의 효과', () => {
  it('선언하면 경력 배점이 만점에서 빠져 100%에 도달한다', () => {
    const result = webCalc(form({ careers: [], noCareer: true }));

    expect(result.careerExcluded).toBe(true);
    expect(result.total).toBe(100);
  });

  it('선언하지 않으면 경력 미작성은 그냥 감점이다', () => {
    const result = webCalc(form({ careers: [] }));

    expect(result.careerExcluded).toBe(false);
    expect(result.total).toBe(80);
  });

  it('선언 시 학력/경력 섹션의 배점도 20으로 줄어든다', () => {
    const section = webCalc(form({ careers: [], noCareer: true })).sections.find(
      (s) => s.key === 'history',
    );

    expect(section?.weight).toBe(20);
    expect(section?.earned).toBe(20);
  });

  it('총점은 100을 넘지 않는다', () => {
    expect(webCalc(form({ noCareer: true })).total).toBeLessThanOrEqual(100);
  });
});

describe('다음 행동 안내', () => {
  it('빈 이력서는 가장 배점이 큰 섹션을 가리킨다', () => {
    const { weakest } = webCalc(EMPTY_FORM);
    expect(weakest?.key).toBe('history');
  });

  it('신입 선언 후에는 경력을 더 채우라고 하지 않는다', () => {
    const history = webCalc(
      form({ careers: [], noCareer: true }),
    ).sections.find((s) => s.key === 'history');

    expect(history?.nextAction).toBeNull();
  });

  it('완성되면 가리킬 곳이 없다', () => {
    expect(webCalc(form()).weakest).toBeNull();
  });
});
