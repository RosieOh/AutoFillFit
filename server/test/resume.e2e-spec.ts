import {
  auth,
  closeTestApp,
  createTestApp,
  createUser,
  http,
  resetDatabase,
  type TestUser,
} from './app';

const FULL = {
  profile: {
    name: '홍길동',
    phone: '010-1234-5678',
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
      admissionDate: '2014-03',
      graduationDate: '2018-02',
    },
  ],
  careers: [
    {
      companyName: '로지소프트',
      jobTitle: '백엔드 개발',
      joinDate: '2020-01',
      isCurrent: true,
      mainTasks: '결제 API 설계',
    },
  ],
  certificates: [{ name: '정보처리기사', issuer: '한국산업인력공단' }],
  essays: [
    { title: '지원 동기', type: 'MOTIVATION', content: '공감했습니다.', isDefault: true },
    { title: '성장 과정', type: 'GROWTH', content: '꾸준했습니다.' },
  ],
};

describe('Resume (통합)', () => {
  let user: TestUser;

  beforeAll(async () => {
    await createTestApp();
  }, 120_000);

  afterAll(closeTestApp);

  beforeEach(async () => {
    await resetDatabase();
    user = await createUser({ email: 'hong@example.com' });
  });

  const save = (body: object) =>
    http().patch('/api/resume/my').set(auth(user.token)).send(body);

  const load = () => http().get('/api/resume/my').set(auth(user.token));

  describe('인증', () => {
    it('토큰 없이 조회하면 401', async () => {
      await http().get('/api/resume/my').expect(401);
    });

    it('토큰 없이 저장하면 401', async () => {
      await http().patch('/api/resume/my').send(FULL).expect(401);
    });

    it('다른 사용자의 이력서는 볼 수 없다 — 내 것만 반환된다', async () => {
      await save(FULL).expect(200);
      const other = await createUser({ email: 'other@example.com' });

      const res = await http()
        .get('/api/resume/my')
        .set(auth(other.token))
        .expect(200);

      expect(res.body.resume).toBeNull();
      expect(res.body.user.email).toBe('other@example.com');
    });
  });

  describe('Upsert', () => {
    it('처음 저장하면 이력서를 만든다', async () => {
      const before = await load().expect(200);
      expect(before.body.resume).toBeNull();

      const res = await save(FULL).expect(200);
      expect(res.body.resume).not.toBeNull();
      expect(res.body.resume.education).toHaveLength(1);
    });

    it('두 번째 저장은 같은 레코드를 수정한다', async () => {
      const first = await save(FULL).expect(200);
      const second = await save({ headline: '시니어 백엔드' }).expect(200);

      expect(second.body.resume.id).toBe(first.body.resume.id);
      expect(second.body.resume.headline).toBe('시니어 백엔드');
    });

    it('지정하지 않은 배열은 그대로 둔다', async () => {
      await save(FULL).expect(200);
      const res = await save({ headline: '수정' }).expect(200);

      expect(res.body.resume.education).toHaveLength(1);
      expect(res.body.resume.careers).toHaveLength(1);
      expect(res.body.resume.essays).toHaveLength(2);
    });

    it('지정한 배열은 통째로 교체한다', async () => {
      await save(FULL).expect(200);
      const res = await save({
        certificates: [{ name: 'SQLD' }, { name: 'TOEIC', score: '925' }],
      }).expect(200);

      expect(res.body.resume.certificates).toHaveLength(2);
      expect(res.body.resume.certificates[0].name).toBe('SQLD');
      // 다른 배열은 유지
      expect(res.body.resume.education).toHaveLength(1);
    });

    it('빈 배열을 보내면 비운다', async () => {
      await save(FULL).expect(200);
      const res = await save({ careers: [] }).expect(200);

      expect(res.body.resume.careers).toEqual([]);
    });

    it('프로필은 지정한 필드만 바꾼다', async () => {
      await save(FULL).expect(200);
      const res = await save({ profile: { address: '서울시 송파구' } }).expect(200);

      expect(res.body.profile.address).toBe('서울시 송파구');
      expect(res.body.profile.name).toBe('홍길동'); // 유지
    });

    it('전화번호를 정규화해 저장한다', async () => {
      const res = await save({ profile: { phone: '010-9999-8888' } }).expect(200);
      expect(res.body.profile.phone).toBe('01099998888');
    });
  });

  describe('extra 얕은 병합', () => {
    it('기존 키를 유지하면서 새 키를 더한다', async () => {
      await save({ extra: { militaryService: '만기전역' } }).expect(200);
      const res = await save({ extra: { noCareer: true } }).expect(200);

      expect(res.body.resume.extra).toEqual({
        militaryService: '만기전역',
        noCareer: true,
      });
    });

    it('같은 키는 덮어쓴다 — 신입 선언을 되돌릴 수 있어야 한다', async () => {
      await save({ extra: { noCareer: true } }).expect(200);
      const res = await save({ extra: { noCareer: false } }).expect(200);

      expect(res.body.resume.extra.noCareer).toBe(false);
    });
  });

  describe('검증', () => {
    it.each([
      ['빈 생년월일', { profile: { birthdate: '' } }],
      ['잘못된 우편번호', { profile: { zipCode: '123' } }],
      ['잘못된 전화번호', { profile: { phone: 'abc' } }],
    ])('%s는 400', async (_label, body) => {
      await save(body).expect(400);
    });

    it('JSONB 내부의 형식 오류도 잡는다', async () => {
      const res = await save({
        education: [{ schoolName: '한국대학교', admissionDate: '2014/03' }],
      }).expect(400);

      expect(JSON.stringify(res.body.message)).toContain('admissionDate');
    });

    it('JSONB 내부의 필수 필드 누락도 잡는다', async () => {
      await save({ essays: [{ title: '제목만' }] }).expect(400);
    });

    it('JSONB 내부의 정의되지 않은 필드도 잡는다', async () => {
      const res = await save({
        careers: [{ companyName: 'A', evilField: 'boom' }],
      }).expect(400);

      expect(JSON.stringify(res.body.message)).toContain('evilField');
    });

    it('최상위의 정의되지 않은 필드는 400', async () => {
      await save({ unknownField: 'boom' }).expect(400);
    });

    it('검증에 실패하면 아무것도 반영되지 않는다', async () => {
      await save(FULL).expect(200);
      await save({
        headline: '바뀌면 안 됨',
        education: [{ schoolName: 'X', admissionDate: '잘못됨' }],
      }).expect(400);

      const res = await load().expect(200);
      expect(res.body.resume.headline).toBeNull();
      expect(res.body.resume.education[0].schoolName).toBe('한국대학교');
    });
  });

  describe('autofill 응답 — 확장이 그대로 쓰는 값', () => {
    it('평탄화된 값을 함께 내려준다', async () => {
      await save(FULL).expect(200);
      const res = await load().expect(200);

      expect(res.body.autofill).toEqual({
        name: '홍길동',
        email: 'hong@example.com',
        phone: '01012345678',
        birthdate: '1995-03-02',
        address: '서울시 강남구 테헤란로 123',
        zipCode: '06236',
        coverLetter: '공감했습니다.',
        essays: [
          {
            title: '지원 동기',
            type: 'MOTIVATION',
            keywords: [],
            charLimit: null,
            isDefault: true,
            content: '공감했습니다.',
          },
          {
            title: '성장 과정',
            type: 'GROWTH',
            keywords: [],
            charLimit: null,
            isDefault: false,
            content: '꾸준했습니다.',
          },
        ],
        education: [
          {
            schoolName: '한국대학교',
            major: '컴퓨터공학',
            degree: 'BACHELOR',
            status: 'GRADUATED',
            gpa: null,
            gpaScale: null,
            admissionDate: '2014-03',
            graduationDate: '2018-02',
          },
        ],
        careers: [
          {
            companyName: '로지소프트',
            department: null,
            jobTitle: '백엔드 개발',
            position: null,
            joinDate: '2020-01',
            leaveDate: null,
            isCurrent: true,
            mainTasks: '결제 API 설계',
          },
        ],
        certificates: [
          {
            name: '정보처리기사',
            issuer: '한국산업인력공단',
            acquiredAt: null,
            score: null,
          },
        ],
      });
    });

    /**
     * 확장은 이 배열로 문항별 매칭을 한다.
     * 하나로 뭉개서 내려주면 문항이 여러 개인 지원서에서 같은 답이 반복된다.
     */
    it('문항을 뭉개지 않고 전부 내려준다', async () => {
      await save(FULL).expect(200);
      const res = await load().expect(200);

      expect(res.body.autofill.essays).toHaveLength(2);
      expect(res.body.autofill.essays.map((e) => e.title)).toEqual([
        '지원 동기',
        '성장 과정',
      ]);
    });

    it('매칭에 필요한 keywords·charLimit을 함께 내려준다', async () => {
      await save({
        essays: [
          {
            title: '입사 후 포부',
            type: 'ASPIRATION',
            content: '3년 안에 정산까지.',
            keywords: ['3년', '정산'],
            charLimit: 800,
          },
        ],
      }).expect(200);

      const res = await load().expect(200);
      expect(res.body.autofill.essays[0]).toEqual({
        title: '입사 후 포부',
        type: 'ASPIRATION',
        keywords: ['3년', '정산'],
        charLimit: 800,
        isDefault: false,
        content: '3년 안에 정산까지.',
      });
    });

    it('제목이나 본문이 빈 문항은 내려보내지 않는다 — 확장이 빈 칸을 채우게 된다', async () => {
      await save({
        essays: [
          { title: '  ', content: '내용은 있음' },
          { title: '제목은 있음', content: '   ' },
          { title: '정상', content: '정상 내용' },
        ],
      }).expect(200);

      const res = await load().expect(200);
      expect(res.body.autofill.essays).toHaveLength(1);
      expect(res.body.autofill.essays[0].title).toBe('정상');
    });

    it('이력서가 없으면 빈 배열 — null이면 확장이 순회에서 터진다', async () => {
      const res = await load().expect(200);
      expect(res.body.autofill.essays).toEqual([]);
      expect(res.body.autofill.education).toEqual([]);
      expect(res.body.autofill.careers).toEqual([]);
      expect(res.body.autofill.certificates).toEqual([]);
    });

    /**
     * 대시보드는 학력 20점·경력 20점·자격증 10점을 채우게 한다.
     * 여기서 내려보내지 않으면 그 70점이 지원서에 한 글자도 들어가지 않는다.
     */
    it('학력·경력·자격증을 평탄화해 내려준다', async () => {
      await save(FULL).expect(200);
      const res = await load().expect(200);

      expect(res.body.autofill.education[0]).toEqual({
        schoolName: '한국대학교',
        major: '컴퓨터공학',
        degree: 'BACHELOR',
        status: 'GRADUATED',
        gpa: null,
        gpaScale: null,
        admissionDate: '2014-03',
        graduationDate: '2018-02',
      });
      expect(res.body.autofill.careers[0].companyName).toBe('로지소프트');
      expect(res.body.autofill.certificates[0].name).toBe('정보처리기사');
    });

    it('최종학력이 첫 항목이다 — 지원서가 한 칸만 받으면 그것을 쓴다', async () => {
      await save({
        education: [
          { schoolName: '한국고등학교', degree: 'HIGH_SCHOOL', graduationDate: '2014-02' },
          { schoolName: '한국대학교', degree: 'BACHELOR', graduationDate: '2018-02' },
        ],
      }).expect(200);

      const res = await load().expect(200);
      expect(res.body.autofill.education.map((e) => e.schoolName)).toEqual([
        '한국대학교',
        '한국고등학교',
      ]);
    });

    it('재직 중인 회사가 첫 항목이고 퇴사년월은 비운다', async () => {
      await save({
        careers: [
          { companyName: '이전회사', joinDate: '2018-01', leaveDate: '2019-12' },
          {
            companyName: '현재회사',
            joinDate: '2020-01',
            leaveDate: '2023-12',
            isCurrent: true,
          },
        ],
      }).expect(200);

      const res = await load().expect(200);
      expect(res.body.autofill.careers[0].companyName).toBe('현재회사');
      // 재직 중인데 퇴사년월이 지원서에 들어가면 거짓이 된다
      expect(res.body.autofill.careers[0].leaveDate).toBeNull();
      expect(res.body.autofill.careers[1].leaveDate).toBe('2019-12');
    });

    it('이름이 빈 항목은 내려보내지 않는다', async () => {
      await save({
        education: [{ schoolName: '  ' }, { schoolName: '한국대학교' }],
        certificates: [{ name: '' }, { name: '정보처리기사' }],
      }).expect(200);

      const res = await load().expect(200);
      expect(res.body.autofill.education).toHaveLength(1);
      expect(res.body.autofill.certificates).toHaveLength(1);
    });

    it('isDefault 문항을 기본 자소서로 고른다', async () => {
      await save({
        essays: [
          { title: '첫째', content: '첫 번째 내용' },
          { title: '둘째', content: '두 번째 내용', isDefault: true },
        ],
      }).expect(200);

      const res = await load().expect(200);
      expect(res.body.autofill.coverLetter).toBe('두 번째 내용');
    });

    it('isDefault가 없으면 MOTIVATION 유형을 고른다', async () => {
      await save({
        essays: [
          { title: '성장', type: 'GROWTH', content: '성장 내용' },
          { title: '지원동기', type: 'MOTIVATION', content: '지원 동기 내용' },
        ],
      }).expect(200);

      const res = await load().expect(200);
      expect(res.body.autofill.coverLetter).toBe('지원 동기 내용');
    });

    it('이력서가 없으면 coverLetter는 null', async () => {
      const res = await load().expect(200);
      expect(res.body.autofill.coverLetter).toBeNull();
    });
  });

  describe('updatedAt', () => {
    it('이력서가 없으면 저장 이력이 없다는 것을 구분할 수 있다', async () => {
      const res = await load().expect(200);
      expect(res.body.resume).toBeNull();
    });

    it('저장하면 이력서가 생긴다', async () => {
      await save({ headline: 'x' }).expect(200);
      const res = await load().expect(200);
      expect(res.body.resume).not.toBeNull();
      expect(res.body.updatedAt).toEqual(expect.any(String));
    });
  });
});
