import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertMyResumeDto } from './dto/upsert-my-resume.dto';
import { MyResumeResponse, ResumeService } from './resume.service';

@Controller('api/resume')
@UseGuards(JwtAuthGuard)
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  /**
   * GET /api/resume/my
   * Chrome Extension이 자동입력 직전에 호출하는 조회 엔드포인트.
   * 프로필 + 최신 이력서 전체 JSON을 반환한다.
   */
  @Get('my')
  findMy(@CurrentUser('id') userId: string): Promise<MyResumeResponse> {
    return this.resumeService.findMy(userId);
  }

  /**
   * PATCH /api/resume/my
   * 프로필 및 이력서 데이터 추가/수정 (Upsert).
   * 레코드가 없으면 생성하고, 본문에 포함된 필드만 반영한다.
   */
  @Patch('my')
  upsertMy(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertMyResumeDto,
  ): Promise<MyResumeResponse> {
    return this.resumeService.upsertMy(userId, dto);
  }
}
