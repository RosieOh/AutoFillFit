import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';

export interface JwtPayload {
  /** user id */
  sub: string;
  email: string;
}

/** JwtAuthGuard 통과 후 req.user에 주입되는 값 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * 토큰 서명이 검증된 뒤 호출된다.
   * 권한은 토큰이 아니라 매번 DB에서 읽는다. 토큰에 role을 넣어두면
   * 관리자 권한을 회수해도 기존 토큰이 만료될 때까지 그대로 통한다.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
