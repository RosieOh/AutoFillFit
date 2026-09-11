import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * 통합 테스트용 데이터베이스.
 *
 * 기본은 testcontainers — 개발자의 로컬 Postgres 자격증명에 기대지 않고
 * 어디서든(그리고 CI에서) 같은 조건으로 돌아야 하기 때문이다.
 *
 * Docker가 없거나 이미 쓸 수 있는 DB가 있으면 TEST_DATABASE_URL로 대체한다.
 *   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/autofill_fit_test
 */

let container: StartedPostgreSqlContainer | null = null;

export interface TestDbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function parseUrl(url: string): TestDbConfig {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

export async function startTestDatabase(): Promise<TestDbConfig> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) return parseUrl(url);

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('autofill_fit_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  return {
    host: container.getHost(),
    port: container.getPort(),
    username: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  };
}

export async function stopTestDatabase(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}

/** AppModule이 읽는 환경변수에 접속 정보를 심는다. */
export function applyDbEnv(config: TestDbConfig): void {
  process.env.DB_HOST = config.host;
  process.env.DB_PORT = String(config.port);
  process.env.DB_USERNAME = config.username;
  process.env.DB_PASSWORD = config.password;
  process.env.DB_DATABASE = config.database;
  process.env.DB_SYNCHRONIZE = 'true';
  process.env.JWT_SECRET = 'integration-test-secret-key-1234567890';
  process.env.JWT_EXPIRES_IN = '1h';
  // AppModule은 NODE_ENV !== 'production'일 때 SQL을 전부 찍는다.
  // 테스트 출력이 파묻히므로 production으로 둔다(다른 동작 차이는 없다).
  process.env.NODE_ENV = 'production';
}
