import {
  auth,
  closeTestApp,
  createTestApp,
  createUser,
  getDataSource,
  http,
  resetDatabase,
} from './app';
import { Profile, User } from '../src/users/entities';
import { Resume } from '../src/resume/entities/resume.entity';

/**
 * 내 데이터 내보내기와 회원 탈퇴.
 *
 * 개인정보보호법 제35조(열람)·제36조(삭제). 이 경로가 생기기 전에는
 * 사용자가 이름·연락처·생년월일·주소·자소서 전문을 넣어 놓고도
 * 나갈 방법이 없었다 — 삭제 API는 관리자 전용 하나뿐이었고,
 * 관리자에게 요청할 이메일 발송 경로조차 없었다.
 */

const RESUME = {
  profile: { name: '홍길동', phone: '01012345678', birthdate: '1995-03-02' },
  education: [{ schoolName: '한국대학교', major: '컴퓨터공학' }],
  careers: [{ companyName: '로지소프트', jobTitle: '백엔드' }],
  certificates: [{ name: '정보처리기사' }],
  essays: [{ title: '지원 동기', content: '공감했습니다.' }],
};

describe('내 계정 (통합)', () => {
  beforeAll(async () => {
    await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('GET /api/users/me/export', () => {
    it('토큰 없이는 거부한다', async () => {
      await http().get('/api/users/me/export').expect(401);
    });

    it('계정·인적사항·이력서를 한 파일로 내려준다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await http()
        .patch('/api/resume/my')
        .set(auth(user.token))
        .send(RESUME)
        .expect(200);

      const res = await http()
        .get('/api/users/me/export')
        .set(auth(user.token))
        .expect(200);

      expect(res.body.account.email).toBe('hong@example.com');
      expect(res.body.account.policyVersion).toEqual(expect.any(String));
      expect(res.body.profile.name).toBe('홍길동');
      expect(res.body.resume.education[0].schoolName).toBe('한국대학교');
      expect(res.body.resume.essays[0].content).toBe('공감했습니다.');
      expect(res.body.exportedAt).toEqual(expect.any(String));
    });

    it('비밀번호 해시는 내보내지 않는다', async () => {
      const user = await createUser({ email: 'hong@example.com' });

      const res = await http()
        .get('/api/users/me/export')
        .set(auth(user.token))
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('$2b$');
      expect(res.body.account).not.toHaveProperty('password');
    });

    it('이력서가 없어도 계정 정보는 내려준다', async () => {
      const user = await createUser({ email: 'empty@example.com' });

      const res = await http()
        .get('/api/users/me/export')
        .set(auth(user.token))
        .expect(200);

      expect(res.body.account.email).toBe('empty@example.com');
      expect(res.body.resume).toBeNull();
    });

    it('남의 데이터는 볼 수 없다 — 토큰 주인의 것만 나온다', async () => {
      const mine = await createUser({ email: 'mine@example.com' });
      const other = await createUser({ email: 'other@example.com' });
      await http()
        .patch('/api/resume/my')
        .set(auth(other.token))
        .send(RESUME)
        .expect(200);

      const res = await http()
        .get('/api/users/me/export')
        .set(auth(mine.token))
        .expect(200);

      expect(res.body.account.email).toBe('mine@example.com');
      expect(res.body.resume).toBeNull();
    });
  });

  describe('DELETE /api/users/me', () => {
    it('토큰 없이는 거부한다', async () => {
      await http().delete('/api/users/me').send({ password: 'x' }).expect(401);
    });

    it('비밀번호가 필요하다', async () => {
      const user = await createUser({ email: 'hong@example.com' });

      await http().delete('/api/users/me').set(auth(user.token)).send({}).expect(400);
    });

    it('비밀번호가 틀리면 지우지 않는다', async () => {
      const user = await createUser({ email: 'hong@example.com' });

      await http()
        .delete('/api/users/me')
        .set(auth(user.token))
        .send({ password: 'wrong-password' })
        .expect(401);

      const still = await getDataSource()
        .getRepository(User)
        .findOne({ where: { email: 'hong@example.com' } });
      expect(still).not.toBeNull();
    });

    it('탈퇴하면 인적사항과 이력서까지 함께 지워진다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await http()
        .patch('/api/resume/my')
        .set(auth(user.token))
        .send(RESUME)
        .expect(200);

      await http()
        .delete('/api/users/me')
        .set(auth(user.token))
        .send({ password: 'passw0rd123' })
        .expect(200);

      const ds = getDataSource();
      expect(await ds.getRepository(User).count()).toBe(0);
      // 고아로 남으면 계정만 사라지고 개인정보는 DB에 그대로 있다
      expect(await ds.getRepository(Profile).count()).toBe(0);
      expect(await ds.getRepository(Resume).count()).toBe(0);
    });

    it('탈퇴한 계정의 기존 토큰은 더 이상 통하지 않는다', async () => {
      const user = await createUser({ email: 'hong@example.com' });

      await http()
        .delete('/api/users/me')
        .set(auth(user.token))
        .send({ password: 'passw0rd123' })
        .expect(200);

      await http().get('/api/resume/my').set(auth(user.token)).expect(401);
    });

    it('같은 이메일로 다시 가입할 수 있다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await http()
        .delete('/api/users/me')
        .set(auth(user.token))
        .send({ password: 'passw0rd123' })
        .expect(200);

      await createUser({ email: 'hong@example.com' });
    });

    it('남의 계정은 지울 수 없다 — 토큰 주인만 지워진다', async () => {
      const mine = await createUser({ email: 'mine@example.com' });
      await createUser({ email: 'other@example.com' });

      await http()
        .delete('/api/users/me')
        .set(auth(mine.token))
        .send({ password: 'passw0rd123' })
        .expect(200);

      const remaining = await getDataSource().getRepository(User).find();
      expect(remaining.map((u) => u.email)).toEqual(['other@example.com']);
    });
  });
});
