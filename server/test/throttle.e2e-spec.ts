import {
  closeTestApp,
  createTestApp,
  createUser,
  http,
  resetDatabase,
} from './app';

/**
 * IP 기준 요청 제한.
 *
 * 다른 통합 테스트는 한 IP에서 수십 번 로그인하므로 제한을 꺼 두고 돈다
 * (database.ts의 THROTTLE_DISABLED). 이 파일만 켠 채로 돌려서,
 * 제한이 실제로 걸리는지 확인한다.
 *
 * 막지 않으면 bcrypt cost 12가 libuv 스레드풀(기본 4개)을 포화시키고,
 * 그 뒤로 들어오는 확장의 GET /api/resume/my가 전부 큐에 밀린다.
 */

describe('요청 제한 (통합)', () => {
  beforeAll(async () => {
    await createTestApp();
    // createTestApp이 applyDbEnv로 꺼 둔 것을 이 파일에서만 되돌린다.
    process.env.THROTTLE_DISABLED = 'false';
  }, 120_000);

  afterAll(async () => {
    process.env.THROTTLE_DISABLED = 'true';
    await closeTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  /*
   * 이 테스트를 먼저 둔다.
   * 아래 테스트들이 가입·로그인 한도를 일부러 소진하므로,
   * 그 뒤에 createUser를 부르면 가입 자체가 429로 막힌다.
   */
  it('토큰이 필요한 경로는 제한에서 뺀다 — 대시보드가 주기적으로 부른다', async () => {
    const user = await createUser({ email: 'me@example.com' });

    for (let i = 0; i < 20; i += 1) {
      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
    }
  });

  it('로그인을 분당 한계 이상 시도하면 429를 낸다', async () => {
    const attempt = () =>
      http()
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever123' });

    const codes: number[] = [];
    for (let i = 0; i < 14; i += 1) {
      codes.push((await attempt()).status);
    }

    // 앞쪽은 통과(401), 한계를 넘으면 429
    expect(codes).toContain(401);
    expect(codes).toContain(429);
    expect(codes[codes.length - 1]).toBe(429);
  });

  it('가입도 제한된다 — 스팸 가입을 막는다', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await http()
        .post('/auth/signup')
        .send({
          email: `spam${i}@example.com`,
          password: 'passw0rd123',
          termsAgreed: true,
          privacyAgreed: true,
        });
      codes.push(res.status);
    }

    expect(codes).toContain(201);
    expect(codes).toContain(429);
  });

});
