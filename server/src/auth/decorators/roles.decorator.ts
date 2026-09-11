import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

/** 이 핸들러(또는 컨트롤러)에 접근할 수 있는 역할을 지정한다. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
