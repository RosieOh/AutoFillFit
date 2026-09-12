import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ResumeModule } from './resume/resume.module';

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
        // 운영에서는 반드시 false로 두고 마이그레이션을 사용할 것
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
        logging: config.get<string>('NODE_ENV') !== 'production',
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
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
