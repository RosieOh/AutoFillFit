import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../strategies/jwt.strategy';

/**
 * @Roles(...)로 지정된 역할만 통과시킨다.
 * 반드시 JwtAuthGuard 뒤에 배치해야 req.user가 채워져 있다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 역할 제약이 없으면 통과 (인증은 JwtAuthGuard가 이미 확인했다)
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    return true;
  }
}
