import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../auth/strategies/jwt.strategy';

/**
 * JwtAuthGuard가 주입한 req.user를 컨트롤러 파라미터로 꺼낸다.
 * `@CurrentUser('id') userId: string` 처럼 특정 필드만 뽑을 수도 있다.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
