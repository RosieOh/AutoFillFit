import {
  auth,
  closeTestApp,
  createTestApp,
  createUser,
  getDataSource,
  http,
  promoteToAdmin,
  resetDatabase,
  type TestUser,
} from './app';
import { Profile } from '../src/users/entities/profile.entity';
import { Resume } from '../src/resume/entities/resume.entity';
import { User, UserRole } from '../src/users/entities/user.entity';

describe('Admin (통합)', () => {
  let admin: TestUser;
  let member: TestUser;

  beforeAll(async () => {
    await createTestApp();
  }, 120_000);

  afterAll(closeTestApp);

  beforeEach(async () => {
    await resetDatabase();

    admin = await createUser({ email: 'boss@example.com' });
    await promoteToAdmin(admin);

    member = await createUser({
      email: 'hong@example.com',
      name: '홍길동',
      phone: '010-1234-5678',
    });

    await http()
      .patch('/api/resume/my')
      .set(auth(member.token))
      .send({
        profile: {
          birthdate: '1995-03-02',
          address: '서울시 강남구 테헤란로 123',
          zipCode: '06236',
        },
        education: [{ schoolName: '한국대학교', major: '컴퓨터공학' }],
        essays: [{ title: '지원 동기', content: '귀사의 기술 문화에 공감했습니다.' }],
      })
      .expect(200);
  });

  const asAdmin = (path: string) => http().get(path).set(auth(admin.token));

  describe('권한', () => {
    it.each([
      '/admin/stats',
      '/admin/users',
      '/admin/audit-logs',
    ])('%s — 토큰이 없으면 401', async (path) => {
      await http().get(path).expect(401);
    });

    it.each([
      '/admin/stats',
      '/admin/users',
      '/admin/audit-logs',
    ])('%s — 일반 사용자는 403', async (path) => {
      await http().get(path).set(auth(member.token)).expect(403);
    });

    it('권한이 회수되면 기존 토큰이 즉시 막힌다 — 토큰에 role을 넣지 않는 이유', async () => {
      await asAdmin('/admin/stats').expect(200);

      await getDataSource()
        .getRepository(User)
        .update({ id: admin.id }, { role: UserRole.USER });

      await asAdmin('/admin/stats').expect(403);
    });
  });

  describe('마스킹', () => {
    it('목록의 이메일과 이름이 가려진다', async () => {
      const res = await asAdmin('/admin/users').expect(200);
      const row = res.body.items.find((u: { id: string }) => u.id === member.id);

      expect(row.email).not.toBe('hong@example.com');
      expect(row.email).toContain('@example.com');
      expect(row.name).toBe('홍*동');
      expect(row.masked).toBe(true);
    });

    it('상세 기본값은 마스킹이고 자소서 본문은 아예 오지 않는다', async () => {
      const res = await asAdmin(`/admin/users/${member.id}`).expect(200);

      expect(res.body.masked).toBe(true);
      expect(res.body.profile.phone).toBe('010-****-5678');
      expect(res.body.profile.birthdate).toBe('1995-**-**');
      expect(res.body.resume.essays[0].content).toBeNull();
      expect(res.body.resume.essays[0].contentLength).toBeGreaterThan(0);
    });

    it('마스킹 응답 어디에도 원문이 들어 있지 않다', async () => {
      const res = await asAdmin(`/admin/users/${member.id}`).expect(200);
      const body = JSON.stringify(res.body);

      expect(body).not.toContain('hong@example.com');
      expect(body).not.toContain('01012345678');
      expect(body).not.toContain('귀사의 기술 문화에 공감했습니다.');
    });
  });

  describe('원본 열람', () => {
    it('사유가 없으면 400 — 사유 없는 열람은 허용하지 않는다', async () => {
      const res = await asAdmin(`/admin/users/${member.id}?reveal=true`).expect(400);
      expect(res.body.message).toContain('사유');
    });

    it('정의되지 않은 사유는 400', async () => {
      await asAdmin(`/admin/users/${member.id}?reveal=true&reason=BOGUS`).expect(400);
    });

    it('사유가 있으면 원본을 준다', async () => {
      const res = await asAdmin(
        `/admin/users/${member.id}?reveal=true&reason=SUPPORT`,
      ).expect(200);

      expect(res.body.masked).toBe(false);
      expect(res.body.profile.phone).toBe('01012345678');
      expect(res.body.resume.essays[0].content).toBe(
        '귀사의 기술 문화에 공감했습니다.',
      );
    });

    it('열람이 사유와 함께 감사 로그에 남는다', async () => {
      await asAdmin(
        `/admin/users/${member.id}?reveal=true&reason=ABUSE_REPORT`,
      ).expect(200);

      const res = await asAdmin('/admin/audit-logs').expect(200);
      const log = res.body.items[0];

      expect(log.action).toBe('REVEAL_PII');
      expect(log.detail.reason).toBe('ABUSE_REPORT');
      expect(log.targetUserId).toBe(member.id);
    });

    it('마스킹 조회는 로그를 남기지 않는다', async () => {
      await asAdmin(`/admin/users/${member.id}`).expect(200);

      const res = await asAdmin('/admin/audit-logs').expect(200);
      expect(res.body.total).toBe(0);
    });

    it('감사 로그의 이메일도 마스킹된다', async () => {
      await asAdmin(
        `/admin/users/${member.id}?reveal=true&reason=SUPPORT`,
      ).expect(200);

      const res = await asAdmin('/admin/audit-logs').expect(200);
      expect(JSON.stringify(res.body)).not.toContain('hong@example.com');
    });
  });

  describe('계정 관리', () => {
    const patch = (id: string, body: object) =>
      http().patch(`/admin/users/${id}`).set(auth(admin.token)).send(body);

    it('비활성화하면 대상의 로그인과 기존 토큰이 모두 막힌다', async () => {
      await patch(member.id, { isActive: false }).expect(200);

      await http()
        .post('/auth/login')
        .send({ email: 'hong@example.com', password: 'passw0rd123' })
        .expect(401);

      await http().get('/api/resume/my').set(auth(member.token)).expect(401);
    });

    it('자기 자신의 권한은 바꿀 수 없다', async () => {
      await patch(admin.id, { role: 'USER' }).expect(403);
    });

    it('자기 자신을 비활성화할 수 없다', async () => {
      await patch(admin.id, { isActive: false }).expect(403);
    });

    it('자기 자신을 삭제할 수 없다', async () => {
      await http()
        .delete(`/admin/users/${admin.id}`)
        .set(auth(admin.token))
        .expect(403);
    });

    it('변경할 항목이 없으면 400', async () => {
      await patch(member.id, {}).expect(400);
    });

    it('권한 변경이 감사 로그에 전후 값과 함께 남는다', async () => {
      await patch(member.id, { role: 'ADMIN' }).expect(200);

      const res = await asAdmin('/admin/audit-logs').expect(200);
      expect(res.body.items[0]).toMatchObject({
        action: 'UPDATE_ROLE',
        detail: { from: 'USER', to: 'ADMIN' },
      });
    });

    it('마지막 관리자는 삭제할 수 없다', async () => {
      await http()
        .delete(`/admin/users/${admin.id}`)
        .set(auth(admin.token))
        .expect(403);
    });
  });

  describe('계정 삭제', () => {
    it('프로필과 이력서가 함께 지워진다 — 고아 데이터가 남지 않는다', async () => {
      await http()
        .delete(`/admin/users/${member.id}`)
        .set(auth(admin.token))
        .expect(200);

      const ds = getDataSource();
      expect(
        await ds.getRepository(Profile).count({ where: { userId: member.id } }),
      ).toBe(0);
      expect(
        await ds.getRepository(Resume).count({ where: { userId: member.id } }),
      ).toBe(0);
    });

    it('삭제해도 감사 로그는 남는다 — 누가 지웠는지 추적할 수 있어야 한다', async () => {
      await http()
        .delete(`/admin/users/${member.id}`)
        .set(auth(admin.token))
        .expect(200);

      const res = await asAdmin('/admin/audit-logs').expect(200);
      expect(res.body.items[0].action).toBe('DELETE_USER');
    });
  });

  describe('목록', () => {
    it('이메일로 검색한다', async () => {
      const res = await asAdmin('/admin/users?q=hong').expect(200);
      expect(res.body.total).toBe(1);
    });

    it('권한으로 거른다', async () => {
      const res = await asAdmin('/admin/users?role=ADMIN').expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].role).toBe('ADMIN');
    });

    it('페이지 정보를 함께 준다', async () => {
      const res = await asAdmin('/admin/users?limit=1').expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(2);
      expect(res.body.totalPages).toBe(2);
    });

    it('limit 상한을 넘기면 400', async () => {
      await asAdmin('/admin/users?limit=9999').expect(400);
    });
  });

  describe('통계', () => {
    it('신입 선언을 반영해 완성도를 계산한다 — 클라이언트와 같은 규칙', async () => {
      await http()
        .patch('/api/resume/my')
        .set(auth(member.token))
        .send({
          profile: {
            name: '홍길동',
            phone: '010-1234-5678',
            birthdate: '1995-03-02',
            address: '서울시 강남구',
            zipCode: '06236',
          },
          education: [
            {
              schoolName: '한국대학교',
              major: '컴퓨터공학',
              admissionDate: '2014-03',
              graduationDate: '2018-02',
            },
          ],
          careers: [],
          certificates: [{ name: '정보처리기사', issuer: 'x' }],
          essays: [
            { title: 'a', content: 'a' },
            { title: 'b', content: 'b' },
          ],
          extra: { noCareer: true },
        })
        .expect(200);

      const res = await asAdmin(`/admin/users/${member.id}`).expect(200);

      expect(res.body.completeness.careerExcluded).toBe(true);
      // 경력 점수를 분자에서도 뺀다 — 분모만 줄이면 클라이언트와 어긋난다
      expect(res.body.completeness.sections.history).toBe(20);
      expect(res.body.completeness.total).toBe(100);
    });

    it('집계 지표를 준다', async () => {
      const res = await asAdmin('/admin/stats').expect(200);

      expect(res.body.totals.users).toBe(2);
      expect(res.body.totals.admins).toBe(1);
      expect(res.body.signupTrend).toHaveLength(30);
      expect(res.body.completeness.sectionWeights).toEqual({
        profile: 30,
        history: 40,
        certificates: 10,
        essays: 20,
      });
    });

    it('개인정보는 통계에 포함되지 않는다', async () => {
      const res = await asAdmin('/admin/stats').expect(200);
      const body = JSON.stringify(res.body);

      expect(body).not.toContain('홍길동');
      expect(body).not.toContain('hong@example.com');
    });
  });
});
