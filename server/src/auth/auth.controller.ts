import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthResponse, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/signup — 회원가입 후 바로 토큰을 발급한다.
   *
   * 가입은 정상 사용자라면 몇 번 이상 부를 일이 없다.
   * 스팸 가입으로 DB와 bcrypt 스레드풀이 동시에 소모되는 것을 막는다.
   */
  @Post('signup')
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.authService.signup(dto);
  }

  /**
   * POST /auth/login — JWT 액세스 토큰 발급
   *
   * IP 기준 제한이다. 계정 단위 잠금은 AuthService가 따로 센다 —
   * 공격자가 IP를 돌려 쓰면 이 제한만으로는 막히지 않기 때문이다.
   */
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/forgot-password — 재설정 링크 요청
   *
   * 가입 여부와 무관하게 항상 같은 응답을 준다. 다르게 답하면 이 경로가
   * 곧 회원 목록 조회기가 된다. 그래서 제한도 더 좁게 건다.
   */
  @Post('forgot-password')
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.authService.requestPasswordReset(dto.email, this.originOf(req));
    return { ok: true };
  }

  /** POST /auth/reset-password — 링크로 비밀번호 변경 */
  @Post('reset-password')
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  /**
   * 메일에 넣을 링크의 출처.
   *
   * 요청 헤더의 Origin을 그대로 쓰면 남의 메일에 공격자 도메인 링크를
   * 심을 수 있다. 설정된 값을 우선 쓰고, 없을 때만 요청 Origin으로 내려간다.
   */
  private originOf(req: Request): string {
    const configured = process.env.WEB_ORIGIN;
    if (configured && configured.trim() !== '') return configured.trim();

    const origin = req.headers.origin;
    return typeof origin === 'string' && origin !== ''
      ? origin
      : 'http://localhost:3000';
  }

  /**
   * GET /auth/me — 확장 프로그램이 저장된 토큰의 유효성을 확인할 때 사용
   *
   * 대시보드가 주기적으로 부르는 경로라 전역 제한에서 뺀다.
   * 이미 JwtAuthGuard가 토큰을 요구하므로 익명 남용은 불가능하다.
   */
  @SkipThrottle()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
