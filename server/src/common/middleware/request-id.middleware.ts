import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * 요청마다 ID를 붙인다.
 *
 * 장애를 신고받았을 때 "언제쯤 안 됐어요"만으로는 로그에서 그 요청을 찾을 수
 * 없다. 응답 헤더로 내려주면 사용자가 그 값을 그대로 알려 줄 수 있고,
 * 예외 필터가 같은 ID를 로그에 남겨 둘을 잇는다.
 *
 * 앞단 프록시가 이미 붙였으면 그 값을 이어 쓴다 — 그래야 한 요청이
 * 게이트웨이 로그와 이 서버 로그에서 같은 ID로 보인다.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const forwarded = Array.isArray(incoming) ? incoming[0] : incoming;

    // 외부 값을 그대로 로그에 넣지 않는다. 길이와 문자를 제한한다.
    const safe =
      forwarded && /^[A-Za-z0-9_-]{1,64}$/.test(forwarded) ? forwarded : null;

    req.id = safe ?? randomUUID();
    res.setHeader('X-Request-Id', req.id);

    next();
  }
}
