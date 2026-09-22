import { createHash } from 'node:crypto';
import {
  closeTestApp,
  createTestApp,
  createUser,
  getDataSource,
  http,
  resetDatabase,
} from './app';
import { PasswordResetToken } from '../src/auth/entities/password-reset-token.entity';
import { User } from '../src/users/entities/user.entity';

/**
 * 비밀번호 재설정.
 *
 * 이 경로가 없을 때는 비밀번호를 잊으면 그 계정이 끝이었다.
 * 관리자에게 부탁할 창구도, 메일을 보낼 방법도 없었다.
 */

const OLD_PASSWORD = 'passw0rd123';
const NEW_PASSWORD = 'newpassw0rd456';

const forgot = (email: string) =>
  http().post('/auth/forgot-password').send({ email });

const reset = (token: string, password: string) =>
  http().post('/auth/reset-password').send({ token, password });

const login = (email: string, password: string) =>
  http().post('/auth/login').send({ email, password });

const tokens = () => getDataSource().getRepository(PasswordResetToken);

/**
 * 메일을 가로챌 수 없으므로 DB의 해시로 원문을 역산한다.
 * 후보를 만들어 해시가 맞는지 확인하는 방식은 불가능하니(32바이트 난수),
 * 테스트에서는 토큰을 직접 심고 그 해시를 저장한다.
 */
const plant = async (userId: string, token: string, over = {}) => {
  const repo = tokens();
  await repo.save(
    repo.create({
      userId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ...over,
    }),
  );
};

describe('비밀번호 재설정 (통합)', () => {
  beforeAll(async () => {
    await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await closeTestApp();
  }, 120_000);

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /auth/forgot-password', () => {
    it('가입된 계정이면 토큰을 만든다', async () => {
      const user = await createUser({ email: 'hong@example.com' });

      await forgot(user.email).expect(200);

      const saved = await tokens().find({ where: { userId: user.id } });
      expect(saved).toHaveLength(1);
      expect(saved[0].tokenHash).toHaveLength(64);
      expect(saved[0].usedAt).toBeNull();
    });

    /**
     * 가입 여부를 응답으로 구분할 수 있으면 이 경로가 곧 회원 목록 조회기다.
     */
    it('없는 계정에도 같은 응답을 준다', async () => {
      const known = await createUser({ email: 'known@example.com' });

      const a = await forgot(known.email).expect(200);
      const b = await forgot('nobody@example.com').expect(200);

      expect(a.body).toEqual(b.body);
      expect(await tokens().count()).toBe(1);
    });

    it('토큰 원문은 저장하지 않는다 — DB가 유출돼도 못 쓰게', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await forgot(user.email).expect(200);

      const saved = await tokens().findOneOrFail({ where: { userId: user.id } });
      // 해시는 16진수 64자다. 원문(64자 hex)과 구분하려면 실제 값을 비교해야 하므로
      // 심어 둔 토큰으로 확인한다.
      expect(saved.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('다시 요청하면 이전 링크는 무효가 된다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await plant(user.id, 'old-token');

      await forgot(user.email).expect(200);

      // 옛 토큰은 사라지고 새로 만든 것만 남는다
      await reset('old-token', NEW_PASSWORD).expect(401);
      expect(await tokens().count()).toBe(1);
    });

    it('형식이 아닌 이메일은 400', async () => {
      await forgot('not-an-email').expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('링크로 비밀번호를 바꾸고 새 비밀번호로 로그인한다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await plant(user.id, 'valid-token');

      await reset('valid-token', NEW_PASSWORD).expect(200);

      await login(user.email, NEW_PASSWORD).expect(200);
      await login(user.email, OLD_PASSWORD).expect(401);
    });

    it('한 번 쓴 링크는 다시 열리지 않는다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await plant(user.id, 'once-token');

      await reset('once-token', NEW_PASSWORD).expect(200);
      await reset('once-token', 'another1234').expect(401);

      // 두 번째 시도로 바뀌지 않았다
      await login(user.email, NEW_PASSWORD).expect(200);
    });

    it('만료된 링크는 거부한다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await plant(user.id, 'stale-token', {
        expiresAt: new Date(Date.now() - 1000),
      });

      await reset('stale-token', NEW_PASSWORD).expect(401);
      await login(user.email, OLD_PASSWORD).expect(200);
    });

    it('없는 토큰은 거부한다', async () => {
      await createUser({ email: 'hong@example.com' });
      await reset('made-up-token', NEW_PASSWORD).expect(401);
    });

    it('약한 비밀번호는 거부한다', async () => {
      const user = await createUser({ email: 'hong@example.com' });
      await plant(user.id, 'weak-token');

      await reset('weak-token', 'short').expect(400);
      await reset('weak-token', 'onlyletters').expect(400);

      // 거부됐으니 토큰은 아직 살아 있어야 한다
      await reset('weak-token', NEW_PASSWORD).expect(200);
    });

    /**
     * 잠긴 계정의 주인이 비밀번호를 잊은 경우다.
     * 메일로 본인임을 증명했으므로 잠금도 함께 풀어 준다.
     */
    it('잠긴 계정도 재설정하면 바로 로그인된다', async () => {
      const user = await createUser({ email: 'locked@example.com' });
      for (let i = 0; i < 5; i += 1) {
        await login(user.email, 'wrong-password');
      }
      await login(user.email, OLD_PASSWORD).expect(401);

      await plant(user.id, 'unlock-token');
      await reset('unlock-token', NEW_PASSWORD).expect(200);

      await login(user.email, NEW_PASSWORD).expect(200);

      const stored = await getDataSource()
        .getRepository(User)
        .findOneOrFail({ where: { id: user.id } });
      expect(stored.failedLoginAttempts).toBe(0);
      expect(stored.lockedUntil).toBeNull();
    });

    it('다른 사람의 비밀번호는 바뀌지 않는다', async () => {
      const mine = await createUser({ email: 'mine@example.com' });
      const other = await createUser({ email: 'other@example.com' });
      await plant(mine.id, 'my-token');

      await reset('my-token', NEW_PASSWORD).expect(200);

      await login(other.email, OLD_PASSWORD).expect(200);
    });

    it('탈퇴한 계정의 토큰은 함께 사라진다', async () => {
      const user = await createUser({ email: 'gone@example.com' });
      await plant(user.id, 'orphan-token');

      await http()
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ password: OLD_PASSWORD })
        .expect(200);

      // 고아로 남으면 지워진 계정의 토큰이 DB에 계속 쌓인다
      expect(await tokens().count()).toBe(0);
    });
  });
});
