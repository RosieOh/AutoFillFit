import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

/**
 * 이 값이 'true'면 요청 제한이 통째로 꺼진다.
 *
 * 모듈 로드 시점에 상수로 굳히면 안 된다 — 테스트는 AppModule을 import한 뒤에
 * 환경변수를 세팅하므로, 그때는 이미 값이 고정돼 제한이 켜진 채로 돈다.
 *
 * 통합 테스트는 한 IP에서 수십 번 로그인하므로 제한을 그대로 두면
 * 테스트가 제한에 걸린다. 그렇다고 제한을 느슨하게 잡으면 운영에서
 * 의미가 없어지므로, 끄는 쪽을 명시적인 플래그로 분리한다.
 *
 * .env.example에 넣지 않았다. 운영에서 실수로 켜지면 인증 API가 무제한이 된다.
 */
function isDisabled(): boolean {
  return process.env.THROTTLE_DISABLED === 'true';
}

/**
 * 신뢰하는 프록시 뒤에서만 X-Forwarded-For를 본다.
 * 무조건 믿으면 헤더를 위조해 제한을 우회할 수 있다.
 */
function trustsProxy(): boolean {
  return process.env.TRUST_PROXY === 'true';
}

/**
 * 요청 제한 가드.
 *
 * 기본 ThrottlerGuard와 다른 점은 위 두 플래그뿐이다.
 * 로드밸런서 뒤에서 소켓 주소만 보면 모든 요청이 같은 IP로 보여
 * 한 사람의 시도가 전체 사용자를 잠근다.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(): Promise<boolean> {
    return isDisabled();
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    if (trustsProxy()) {
      const headers = (req.headers ?? {}) as Record<string, string | string[]>;
      const forwarded = headers['x-forwarded-for'];
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const client = first?.split(',')[0]?.trim();
      if (client) return client;
    }

    return (req.ip as string) ?? 'unknown';
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    if (isDisabled()) return true;
    return super.handleRequest(requestProps);
  }
}
