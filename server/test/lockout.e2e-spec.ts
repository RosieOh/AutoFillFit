import {
  closeTestApp,
  createTestApp,
  createUser,
  getDataSource,
  http,
  resetDatabase,
} from './app';
import { User } from '../src/users/entities/user.entity';

/**
 * 계정 단위 로그인 잠금.
 *
 * IP 기준 제한만으로는 IP를 돌려 쓰는 크리덴셜 스터핑을 막지 못한다.
 * 이 서비스는 계정 하나가 뚫리면 GET /api/resume/my 한 번으로
 * 이름·연락처·생년월일·주소·학력·경력·자소서 전문이 통째로 나간다.
 */

const PASSWORD = 'passw0rd123';

const login = (email: string, password: string) =>
  http().post('/auth/login').send({ email, password });

const failLogin = async (email: string, times: number) => {
  for (let i = 0; i < times; i += 1) {
    await login(email, 'wrong-password-here');
  }
};

const readUser = (email: string) =>
  getDataSource().getRepository(User).findOneOrFail({ where: { email } });

describe('로그인 시도 제한 (통합)', () => {
  beforeAll(async () => {
    await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('실패할 때마다 횟수가 쌓인다', async () => {
    const user = await createUser({ email: 'count@example.com' });

    await failLogin(user.email, 3);

    expect((await readUser(user.email)).failedLoginAttempts).toBe(3);
  });

  it('5회 연속 실패하면 잠긴다', async () => {
    const user = await createUser({ email: 'lock@example.com' });

    await failLogin(user.email, 5);

    const stored = await readUser(user.email);
    expect(stored.failedLoginAttempts).toBe(5);
    expect(stored.lockedUntil).not.toBeNull();
    expect(stored.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('잠긴 뒤에는 올바른 비밀번호도 거부한다', async () => {
    const user = await createUser({ email: 'locked@example.com' });
    await failLogin(user.email, 5);

    const res = await login(user.email, PASSWORD).expect(401);

    // 그냥 '실패'라고만 하면 사용자는 계속 시도한다
    expect(res.body.message).toContain('분 후에');
  });

  it('잠금이 풀리면 다시 로그인할 수 있다', async () => {
    const user = await createUser({ email: 'expired@example.com' });
    await failLogin(user.email, 5);

    // 잠금 시각을 과거로 돌린다 — 시간이 지난 상황
    await getDataSource()
      .getRepository(User)
      .update({ email: user.email }, { lockedUntil: new Date(Date.now() - 1000) });

    await login(user.email, PASSWORD).expect(200);
  });

  it('성공하면 실패 횟수가 0으로 돌아간다', async () => {
    const user = await createUser({ email: 'reset@example.com' });

    await failLogin(user.email, 4);
    expect((await readUser(user.email)).failedLoginAttempts).toBe(4);

    await login(user.email, PASSWORD).expect(200);

    // 남겨 두면 오래전 오타가 쌓여 멀쩡한 사용자가 잠긴다
    const stored = await readUser(user.email);
    expect(stored.failedLoginAttempts).toBe(0);
    expect(stored.lockedUntil).toBeNull();
  });

  it('한 계정의 실패가 다른 계정을 잠그지 않는다', async () => {
    const victim = await createUser({ email: 'victim@example.com' });
    const other = await createUser({ email: 'other@example.com' });

    await failLogin(victim.email, 5);

    await login(other.email, PASSWORD).expect(200);
    expect((await readUser(other.email)).failedLoginAttempts).toBe(0);
  });

  it('없는 계정으로 시도해도 오류를 내지 않는다', async () => {
    await login('nobody@example.com', 'whatever123').expect(401);
  });
});
