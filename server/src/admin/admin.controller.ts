import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AdminService } from './admin.service';
import {
  ListAuditLogsQueryDto,
  ListUsersQueryDto,
  UpdateUserDto,
  UserDetailQueryDto,
} from './dto/admin.dto';

/**
 * 백오피스 API. 모든 엔드포인트가 ADMIN 역할을 요구한다.
 * 역할은 토큰이 아니라 JwtStrategy가 매 요청 DB에서 읽으므로,
 * 권한을 회수하면 기존 토큰도 즉시 막힌다.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/stats — 개요 지표 */
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  /** GET /admin/users — 목록 (개인정보는 마스킹된 상태) */
  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  /** GET /admin/users/:id — 상세. reveal=true면 원본을 내려주고 감사 로그를 남긴다. */
  @Get('users/:id')
  getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: UserDetailQueryDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.adminService.getUser(
      id,
      query.reveal ?? false,
      actor,
      ip,
      query.reason,
    );
  }

  /** PATCH /admin/users/:id — 권한 / 활성 상태 변경 */
  @Patch('users/:id')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.adminService.updateUser(id, dto, actor, ip);
  }

  /** DELETE /admin/users/:id — 계정 및 이력 데이터 삭제 */
  @Delete('users/:id')
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.adminService.deleteUser(id, actor, ip);
  }

  /** GET /admin/audit-logs — 관리자 행위 기록 */
  @Get('audit-logs')
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }
}
