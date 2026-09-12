import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { Profile } from '../users/entities/profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: { id: string; email: string; role: UserRole; createdAt: Date };
}

/** 연속 실패가 이 횟수에 닿으면 잠근다. */
const MAX_LOGIN_ATTEMPTS = 5;

/** 잠금 유지 시간. 짧으면 무의미하고 길면 오타 낸 본인이 갇힌다. */
const LOCK_DURATION_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** 회원가입 — 유저와 기본 프로필을 한 트랜잭션으로 생성한다. */
  async signup(dto: SignupDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();

    const exists = await this.userRepository.exists({ where: { email } });
    if (exists) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(User, { email, password: passwordHash });
      const saved = await manager.save(User, created);

      const profile = manager.create(Profile, {
        userId: saved.id,
        name: dto.name ?? null,
        phone: dto.phone ? dto.phone.replace(/[^0-9+]/g, '') : null,
        birthdate: dto.birthdate ?? null,
        address: dto.address ?? null,
        zipCode: dto.zipCode ?? null,
      });
      await manager.save(Profile, profile);

      return saved;
    });

    return this.buildAuthResponse(user);
  }

  /** 로그인 — 이메일/비밀번호 검증 후 JWT 발급 */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();

    // password는 엔티티에서 select: false 이므로 명시적으로 가져온다.
    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        createdAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    /*
     * 잠긴 계정은 비밀번호를 맞혀도 열리지 않는다.
     * 비밀번호 비교 전에 막아야 bcrypt 비용도 아낀다.
     */
    if (user && this.isLocked(user)) {
      throw new UnauthorizedException(this.lockMessage(user));
    }

    // 계정 존재 여부가 응답 시간으로 새지 않도록 더미 해시와 비교한다.
    const hash =
      user?.password ??
      '$2b$12$0000000000000000000000000000000000000000000000000000';
    const matched = await bcrypt.compare(dto.password, hash);

    if (!user || !matched) {
      if (user) await this.recordFailedLogin(user);
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 비활성 계정은 토큰을 아예 발급하지 않는다.
    // (JwtStrategy도 막지만, 여기서 막아야 사용자가 이유를 알 수 있다.)
    if (!user.isActive) {
      throw new UnauthorizedException(
        '비활성화된 계정입니다. 관리자에게 문의해 주세요.',
      );
    }

    // 성공했으니 실패 기록을 지운다. 남겨 두면 오래된 오타가 쌓여 잠긴다.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }

    return this.buildAuthResponse(user);
  }

  /**
   * 연속 실패를 세고, 한계를 넘으면 일정 시간 잠근다.
   *
   * IP 기준 제한만으로는 IP를 돌려 쓰는 크리덴셜 스터핑을 막지 못한다.
   * 이 서비스는 계정 하나가 뚫리면 이름·연락처·생년월일·주소·학력·경력·
   * 자소서 전문이 한 번에 나가므로 계정 단위로도 센다.
   */
  private async recordFailedLogin(user: User): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: attempts,
        lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
      });
      return;
    }

    await this.userRepository.update(user.id, {
      failedLoginAttempts: attempts,
    });
  }

  private isLocked(user: User): boolean {
    return Boolean(user.lockedUntil && user.lockedUntil.getTime() > Date.now());
  }

  /** 언제 풀리는지 알려준다. 그냥 '실패'라고만 하면 계속 시도하게 된다. */
  private lockMessage(user: User): string {
    const remainingMs = (user.lockedUntil?.getTime() ?? 0) - Date.now();
    const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    return `로그인 시도가 너무 많았습니다. ${minutes}분 후에 다시 시도해 주세요.`;
  }

  private buildAuthResponse(user: User): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: this.jwtService.sign(payload),
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
}
