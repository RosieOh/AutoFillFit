import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthResponse, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
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
