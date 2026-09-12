import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { DeleteMeDto } from './dto/delete-me.dto';
import { MyDataExport, UsersService } from './users.service';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me/export — 내 데이터 전체 내려받기
   *
   * 탈퇴 화면에서 먼저 권한다. 지우고 나면 되돌릴 수 없기 때문이다.
   */
  @Get('me/export')
  exportMe(@CurrentUser() user: AuthUser): Promise<MyDataExport> {
    return this.usersService.exportMyData(user.id);
  }

  /**
   * DELETE /api/users/me — 회원 탈퇴
   *
   * 비밀번호를 다시 받는다. 되돌릴 수 없는 삭제라서다.
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deleteMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteMeDto,
  ): Promise<{ deleted: true }> {
    return this.usersService.deleteMe(user.id, dto.password);
  }
}
