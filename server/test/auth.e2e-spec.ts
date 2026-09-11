import {
  auth,
  closeTestApp,
  createTestApp,
  createUser,
  getDataSource,
  http,
  resetDatabase,
} from './app';
import { User } from '../src/users/entities/user.entity';

describe('Auth (통합)', () => {
  beforeAll(async () => {
    await createTestApp();
  }, 120_000);

  afterAll(closeTestApp);
  beforeEach(resetDatabase);

  describe('POST /auth/signup', () => {
    it('가입하면 토큰과 함께 USER 권한으로 만들어진다', async () => {
      const res = await http()
        .post('/auth/signup')
        .send({ email: 'hong@example.com', password: 'passw0rd123' })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.user).toMatchObject({
        email: 'hong@example.com',
        role: 'USER',
      });
    });

    it('비밀번호는 응답에 포함되지 않는다', async () => {
      const res = await http()
        .post('/auth/signup')
        .send({ email: 'hong@example.com', password: 'passw0rd123' })
        .expect(201);

      expect(JSON.stringify(res.body)).not.toContain('passw0rd123');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('비밀번호는 평문으로 저장되지 않는다', async () => {
      await createUser({ email: 'hong@example.com' });

      const stored = await getDataSource()
        .getRepository(User)
        .findOne({
          where: { email: 'hong@example.com' },
          select: { id: true, password: true },
        });

      expect(stored?.password).not.toBe('passw0rd123');
      expect(stored?.password).toMatch(/^\$2[aby]\$/); // bcrypt
    });

    it('가입과 동시에 프로필을 만든다', async () => {
      const user = await createUser({
        email: 'hong@example.com',
        name: '홍길동',
        phone: '010-1234-5678',
      });

      const res = await http()
        .get('/api/resume/my')
        .set(auth(user.token))
        .expect(200);

      expect(res.body.profile.name).toBe('홍길동');
      // 하이픈은 제거되어 저장된다
      expect(res.body.profile.phone).toBe('01012345678');
    });

    it('같은 이메일은 409', async () => {
      await createUser({ email: 'hong@example.com' });

      await http()
        .post('/auth/signup')
        .send({ email: 'hong@example.com', password: 'passw0rd123' })
        .expect(409);
    });

    it('이메일 대소문자를 구분하지 않는다', async () => {
      await createUser({ email: 'hong@example.com' });

      await http()
        .post('/auth/signup')
        .send({ email: 'HONG@example.com', password: 'passw0rd123' })
        .expect(409);
    });

    it.each([
      ['형식이 아닌 이메일', { email: 'not-an-email', password: 'passw0rd123' }],
      ['짧은 비밀번호', { email: 'a@example.com', password: 'short' }],
      ['숫자 없는 비밀번호', { email: 'a@example.com', password: 'onlyletters' }],
      ['잘못된 전화번호', { email: 'a@example.com', password: 'passw0rd123', phone: 'abc' }],
      ['잘못된 우편번호', { email: 'a@example.com', password: 'passw0rd123', zipCode: '123' }],
    ])('%s는 400', async (_label, body) => {
      await http().post('/auth/signup').send(body).expect(400);
    });

    it('본문으로 관리자 권한을 주입할 수 없다', async () => {
      const res = await http()
        .post('/auth/signup')
        .send({ email: 'evil@example.com', password: 'passw0rd123', role: 'ADMIN' })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('role');
    });

    it('isActive도 주입할 수 없다', async () => {
      await http()
        .post('/auth/signup')
        .send({ email: 'evil@example.com', password: 'passw0rd123', isActive: false })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createUser({ email: 'hong@example.com' });
    });

    it('올바른 자격증명이면 토큰을 준다', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ email: 'hong@example.com', password: 'passw0rd123' })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('비밀번호가 틀리면 401', async () => {
      await http()
        .post('/auth/login')
        .send({ email: 'hong@example.com', password: 'wrongpass123' })
        .expect(401);
    });

    it('없는 계정과 틀린 비밀번호의 응답이 같다 — 계정 존재 여부가 새면 안 된다', async () => {
      const missing = await http()
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'passw0rd123' })
        .expect(401);

      const wrong = await http()
        .post('/auth/login')
        .send({ email: 'hong@example.com', password: 'wrongpass123' })
        .expect(401);

      expect(missing.body.message).toBe(wrong.body.message);
    });
  });

  describe('GET /auth/me', () => {
    it('토큰이 없으면 401', async () => {
      await http().get('/auth/me').expect(401);
    });

    it('위조 토큰이면 401', async () => {
      await http().get('/auth/me').set(auth('a.b.c')).expect(401);
    });

    it('토큰이 있으면 id·email·role을 준다', async () => {
      const user = await createUser({ email: 'hong@example.com' });

      const res = await http().get('/auth/me').set(auth(user.token)).expect(200);

      expect(res.body).toEqual({
        id: user.id,
        email: 'hong@example.com',
        role: 'USER',
      });
    });

    it('탈퇴한 계정의 토큰은 즉시 막힌다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await getDataSource().getRepository(User).delete({ id: user.id });

      await http().get('/auth/me').set(auth(user.token)).expect(401);
    });
  });

  describe('비활성 계정', () => {
    it('로그인 단계에서 막고 이유를 알려준다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await getDataSource()
        .getRepository(User)
        .update({ id: user.id }, { isActive: false });

      const res = await http()
        .post('/auth/login')
        .send({ email: 'hong@example.com', password: 'passw0rd123' })
        .expect(401);

      expect(res.body.message).toContain('비활성화');
    });

    it('이미 발급된 토큰도 즉시 막힌다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await getDataSource()
        .getRepository(User)
        .update({ id: user.id }, { isActive: false });

      await http().get('/api/resume/my').set(auth(user.token)).expect(401);
    });
  });
});
