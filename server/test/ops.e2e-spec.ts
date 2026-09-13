import {
  closeTestApp,
  createTestApp,
  createUser,
  http,
  resetDatabase,
} from './app';

/**
 * 운영에 필요한 최소한의 것들.
 *
 * 이 경로들이 없을 때는 장애가 나도 알아챌 방법이 없었다. 프로세스가
 * 떠 있으면 포트는 열려 있으므로 감시 도구는 정상으로 보고, 사용자가
 * "안 돼요"라고 해도 어느 요청이 죽었는지 로그에서 찾을 수 없었다.
 */

describe('운영 (통합)', () => {
  beforeAll(async () => {
    await createTestApp();
  }, 120_000);

  // 컨테이너 종료가 기본 30초를 넘길 때가 있다. 다른 스위트는 테스트가 길어
  // 그동안 컨테이너가 자리를 잡지만, 이 스위트는 금방 끝나 바로 종료로 들어간다.
  afterAll(async () => {
    await closeTestApp();
  }, 120_000);

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('GET /health', () => {
    it('토큰 없이도 응답한다 — 로드밸런서는 토큰이 없다', async () => {
      const res = await http().get('/health').expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('up');
      expect(res.body.uptimeSeconds).toEqual(expect.any(Number));
    });

    it('내부 정보를 흘리지 않는다', async () => {
      const res = await http().get('/health').expect(200);
      const body = JSON.stringify(res.body);

      // 버전·환경·DB 접속 정보가 익명 응답에 섞이면 정찰 재료가 된다
      expect(body).not.toMatch(/password|secret|postgres:\/\//i);
      expect(Object.keys(res.body).sort()).toEqual([
        'database',
        'status',
        'uptimeSeconds',
      ]);
    });
  });

  describe('요청 ID', () => {
    it('모든 응답에 X-Request-Id를 붙인다', async () => {
      const res = await http().get('/health').expect(200);

      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('요청마다 다른 ID를 쓴다', async () => {
      const a = await http().get('/health').expect(200);
      const b = await http().get('/health').expect(200);

      expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
    });

    it('앞단이 붙인 ID를 이어 쓴다 — 게이트웨이 로그와 이어야 한다', async () => {
      const res = await http()
        .get('/health')
        .set('X-Request-Id', 'gateway-abc-123')
        .expect(200);

      expect(res.headers['x-request-id']).toBe('gateway-abc-123');
    });

    /*
     * 개행 주입은 HTTP 계층이 이미 막는다 — 클라이언트가 전송 자체를 거부한다.
     * (그걸 테스트로 넣었더니 superagent가 예외를 던지며 소켓을 남겨,
     *  스위트 전체가 종료되지 않았다.)
     *
     * 여기서 막아야 하는 것은 "전송은 되지만 로그에 넣고 싶지 않은 값"이다 —
     * 공백·따옴표·과도한 길이처럼 로그 한 줄을 망가뜨리는 값들.
     */
    it.each([
      ['공백이 섞인 값', 'bad value here'],
      ['따옴표가 든 값', 'id-with-"quote"'],
      ['너무 긴 값', 'x'.repeat(200)],
      ['빈 값', ''],
    ])('%s은 이어 쓰지 않고 새로 만든다', async (_label, injected) => {
      const res = await http()
        .get('/health')
        .set('X-Request-Id', injected)
        .expect(200);

      expect(res.headers['x-request-id']).not.toBe(injected);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('오류 응답에도 ID가 들어간다 — 사용자가 알려 줄 값이다', async () => {
      const res = await http().get('/api/resume/my').expect(401);

      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });
  });

  describe('오류 응답', () => {
    it('검증 오류의 메시지는 그대로 전달한다', async () => {
      const res = await http()
        .post('/auth/signup')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);

      // 사용자가 고칠 수 있는 정보는 가리지 않는다
      expect(JSON.stringify(res.body.message)).toContain('이메일 형식');
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('없는 경로는 404와 함께 ID를 준다', async () => {
      const res = await http().get('/no-such-path').expect(404);
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('정상 요청은 오류 필터를 거치지 않는다', async () => {
      const user = await createUser({ email: 'ok@example.com' });

      await http()
        .get('/api/resume/my')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
    });
  });
});
