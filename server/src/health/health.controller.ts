import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: 'up' | 'down';
}

/**
 * 가동 확인.
 *
 * 프로세스가 살아 있는 것과 서비스가 되는 것은 다르다. DB 연결이 끊기면
 * 모든 요청이 500을 내지만 프로세스는 멀쩡히 떠 있어서, 포트만 보는
 * 감시 도구는 정상으로 판단한다. 그래서 여기서 DB까지 확인한다.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * GET /health
   *
   * 감시 도구가 짧은 주기로 호출하므로 요청 제한에서 뺀다.
   * 인증은 걸지 않는다 — 로드밸런서는 토큰을 갖고 있지 않다.
   * 대신 버전·환경 같은 내부 정보는 내려보내지 않는다.
   */
  @SkipThrottle()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';

    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      /* 아래에서 degraded로 보고한다 */
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      database,
    };
  }
}
