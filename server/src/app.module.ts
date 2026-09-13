import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './health/health.controller';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ResumeModule } from './resume/resume.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_DATABASE', 'autofill_fit'),
        // 엔티티 자동 로드 (TypeOrmModule.forFeature 등록분)
        autoLoadEntities: true,
        /*
         * 운영에서는 절대 켜지 않는다.
         *
         * TypeORM synchronize는 컬럼명을 바꾸면 rename이 아니라 DROP + ADD로
         * 처리한다. resumes의 education·careers·certificates·essays는 전부
         * JSONB고 사용자 이력 전체가 그 안에 있으므로, 컬럼명 하나 정리하는
         * 커밋이 전 사용자의 이력서를 지운다.
         *
         * 환경변수 설정 실수를 코드에서 한 번 더 막는다.
         * 스키마 변경은 src/database/migrations/로만 한다.
         */
        synchronize:
          config.get<string>('NODE_ENV') === 'production'
            ? false
            : config.get<string>('DB_SYNCHRONIZE') === 'true',
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        /*
         * SQL 로깅. DB_LOGGING이 있으면 그 값을 따르고, 없으면 개발에서만 켠다.
         * NODE_ENV로만 판단하면 "로그를 끄려고 production으로 두는" 편법이 생기는데,
         * 그러면 synchronize 가드 같은 다른 production 동작까지 함께 딸려온다.
         */
        logging:
          config.get<string>(
            'DB_LOGGING',
            config.get<string>('NODE_ENV') === 'production' ? 'false' : 'true',
          ) === 'true',
      }),
    }),
    /**
     * 전역 요청 제한.
     *
     * bcrypt cost 12는 해시 비교 한 번에 수백 ms를 쓰고 libuv 스레드풀은
     * 기본 4개다. 제한이 없으면 노트북 한 대의 요청만으로 풀이 포화되고,
     * 그 뒤로 들어오는 확장의 GET /api/resume/my가 전부 큐에 밀린다.
     * 인증 엔드포인트에는 컨트롤러에서 더 좁은 제한을 따로 건다.
     */
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    AuthModule,
    ResumeModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 모든 요청에 ID를 붙인다. 예외 필터가 이 값을 로그와 응답에 남긴다.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
