import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { applyDbEnv, startTestDatabase, stopTestDatabase } from './database';

let app: INestApplication;
let dataSource: DataSource;

/**
 * main.ts와 같은 전역 파이프를 붙여야 한다.
 * 붙이지 않으면 whitelist/forbidNonWhitelisted가 빠져, 실제 서버에서는
 * 400으로 거부되는 요청이 테스트에서는 통과해 버린다.
 */
export async function createTestApp(): Promise<INestApplication> {
  const config = await startTestDatabase();
  applyDbEnv(config);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  await app.init();
  dataSource = app.get(DataSource);
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) await app.close();
  await stopTestDatabase();
}

/** 테스트 간 격리 — 테이블을 비운다. */
export async function resetDatabase(): Promise<void> {
  const tables = dataSource.entityMetadatas
    .map((entity) => `"${entity.tableName}"`)
    .join(', ');

  await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export const http = () => request(app.getHttpServer());

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

let seq = 0;

/** 가입시키고 토큰까지 받아온다. */
export async function createUser(
  overrides: Record<string, unknown> = {},
): Promise<TestUser> {
  seq += 1;
  const email = (overrides.email as string) ?? `user${seq}@example.com`;

  const response = await http()
    .post('/auth/signup')
    .send({ email, password: 'passw0rd123', ...overrides })
    .expect(201);

  return {
    id: response.body.user.id,
    email,
    token: response.body.accessToken,
  };
}

/**
 * 관리자로 승격한다.
 * API로는 만들 수 없다(가입으로 ADMIN이 될 수 없는 것이 설계다) — DB를 직접 바꾼다.
 */
export async function promoteToAdmin(user: TestUser): Promise<void> {
  await dataSource
    .getRepository(User)
    .update({ id: user.id }, { role: UserRole.ADMIN });
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export function getDataSource(): DataSource {
  return dataSource;
}
