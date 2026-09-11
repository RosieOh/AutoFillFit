import { Profile } from '../../users/entities/profile.entity';
import { Resume } from '../../resume/entities/resume.entity';
import { calculateCompleteness, COMPLETENESS_WEIGHTS } from './completeness.util';

/**
 * 이 파일은 실제로 있었던 버그를 고정한다.
 * careerExcluded를 계산해 놓고 scoreHistory에 넘기지 않아, 경력 점수가 분자에 남은 채
 * 분모만 80으로 줄어 서버와 클라이언트가 같은 이력서에 다른 완성도를 냈다.
 */

const profile = (over: Partial<Profile> = {}): Profile =>
  ({
    name: '홍길동',
    phone: '01012345678',
    birthdate: '1995-03-02',
    address: '서울시 강남구 테헤란로 123',
    zipCode: '06236',
    ...over,
  }) as Profile;

const resume = (over: Partial<Resume> = {}): Resume =>
  ({
    education: [
      {
        schoolName: '한국대학교',
        major: '컴퓨터공학',
        admissionDate: '2014-03',
        graduationDate: '2018-02',
      },
    ],
    careers: [
      {
        companyName: '로지소프트',
        jobTitle: '백엔드 개발',
        joinDate: '2020-01',
        mainTasks: '결제 API',
      },
    ],
    certificates: [{ name: '정보처리기사', issuer: '한국산업인력공단' }],
    essays: [
      { title: '지원 동기', content: 'a' },
      { title: '성장 과정', content: 'b' },
    ],
    extra: null,
    ...over,
  }) as Resume;

describe('calculateCompleteness', () => {
  it('아무것도 없으면 0%', () => {
    expect(calculateCompleteness(null, null).total).toBe(0);
  });

  it('모두 채우면 100%', () => {
    const result = calculateCompleteness(profile(), resume());

    expect(result.total).toBe(100);
    expect(result.careerExcluded).toBe(false);
    expect(result.sections).toEqual({
      profile: COMPLETENESS_WEIGHTS.profile,
      history: COMPLETENESS_WEIGHTS.history,
      certificates: COMPLETENESS_WEIGHTS.certificates,
      essays: COMPLETENESS_WEIGHTS.essays,
    });
  });

  it('인적사항은 5개 항목이 균등 배점', () => {
    const result = calculateCompleteness(
      profile({ address: null, zipCode: null }),
      null,
    );

    // 5개 중 3개 = 30점의 3/5
    expect(result.sections.profile).toBeCloseTo(18);
  });

  describe('신입(noCareer) 선언', () => {
    const newcomer = resume({ careers: [], extra: { noCareer: true } });

    it('경력 점수를 분자에서도 뺀다 — 분모만 줄이면 클라이언트와 어긋난다', () => {
      const result = calculateCompleteness(profile(), newcomer);

      // 학력 20점만 — 경력 20점은 계산에 들어가지 않는다
      expect(result.sections.history).toBe(20);
      expect(result.careerExcluded).toBe(true);
    });

    it('나머지를 다 채우면 100%에 도달한다', () => {
      expect(calculateCompleteness(profile(), newcomer).total).toBe(100);
    });

    it('선언했는데 경력이 남아 있어도 그 점수는 세지 않는다', () => {
      const contradictory = resume({ extra: { noCareer: true } });
      const result = calculateCompleteness(profile(), contradictory);

      expect(result.sections.history).toBe(20);
      expect(result.total).toBe(100);
    });

    it('100%를 넘지 않는다', () => {
      const result = calculateCompleteness(profile(), newcomer);
      expect(result.total).toBeLessThanOrEqual(100);
    });
  });

  it('선언하지 않으면 경력 미작성은 그냥 미작성 — 임의로 추측하지 않는다', () => {
    const result = calculateCompleteness(profile(), resume({ careers: [] }));

    expect(result.careerExcluded).toBe(false);
    expect(result.sections.history).toBe(20);
    expect(result.total).toBe(80);
  });

  it('자소서는 2건 이상이어야 만점', () => {
    const one = resume({ essays: [{ title: 'a', content: 'a' }] });
    expect(calculateCompleteness(profile(), one).sections.essays).toBe(12);
  });

  it('제목이나 본문이 비면 자소서로 세지 않는다', () => {
    const empty = resume({ essays: [{ title: 'a', content: '' }] });
    expect(calculateCompleteness(profile(), empty).sections.essays).toBe(0);
  });
});
