import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, LessThan, Repository } from 'typeorm';
import { MailService } from '../common/mail/mail.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Profile } from '../users/entities/profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { POLICY_VERSION } from './policy';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

/**
 * 재설정 링크 유효 시간.
 *
 * 길면 메일함이 뚫렸을 때 창이 넓어지고, 너무 짧으면 메일이 도착하기 전에
 * 만료된다. 한 시간이면 둘 다 감당할 수 있다.
 */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

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
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepository: Repository<PasswordResetToken>,
    private readonly mailService: MailService,
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
      // 동의 시각과 문서 버전을 함께 남긴다. 없으면 나중에 증명할 방법이 없다.
      const agreedAt = new Date();
      const created = manager.create(User, {
        email,
        password: passwordHash,
        termsAgreedAt: agreedAt,
        privacyAgreedAt: agreedAt,
        policyVersion: POLICY_VERSION,
      });
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

  /**
   * 재설정 링크를 보낸다.
   *
   * 가입 여부와 무관하게 항상 같은 응답을 준다. "가입되지 않은 이메일입니다"를
   * 돌려주면 그 화면이 곧 회원 목록 조회기가 된다.
   */
  async requestPasswordReset(email: string, origin: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalized },
    });

    // 없는 계정이어도 조용히 끝낸다.
    if (!user || !user.isActive) return;

    /*
     * 이전에 보낸 링크는 무효로 만든다.
     * 여러 개가 동시에 살아 있으면 오래된 메일로도 바꿀 수 있다.
     */
    await this.resetTokenRepository.delete({ userId: user.id });

    const token = randomBytes(32).toString('hex');
    await this.resetTokenRepository.save(
      this.resetTokenRepository.create({
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      }),
    );

    const link = `${origin}/reset-password?token=${token}`;
    const minutes = Math.round(RESET_TOKEN_TTL_MS / 60000);

    await this.mailService.send({
      to: user.email,
      subject: '[AutoFill-Fit] 비밀번호 재설정',
      text:
        `아래 링크에서 비밀번호를 다시 설정할 수 있습니다.\n\n` +
        `${link}\n\n` +
        `이 링크는 ${minutes}분 동안, 한 번만 사용할 수 있습니다.\n` +
        `요청한 적이 없다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않습니다.`,
    });
  }

  /**
   * 링크로 비밀번호를 바꾼다.
   *
   * 토큰은 한 번만 쓸 수 있다. 메일이 전달되는 경로는 안전하지 않으므로,
   * 한 번 쓴 뒤에는 같은 링크가 다시 열리지 않아야 한다.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    // 만료된 것들은 이 기회에 치운다.
    await this.resetTokenRepository.delete({ expiresAt: LessThan(new Date()) });

    const record = await this.resetTokenRepository.findOne({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(
        '링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, record.userId, {
        password: passwordHash,
        // 잠겨 있었다면 함께 풀어 준다. 본인이 맞다는 것을 메일로 증명했다.
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      await manager.update(PasswordResetToken, record.id, {
        usedAt: new Date(),
      });
    });
  }

  /**
   * 토큰은 해시만 저장한다.
   *
   * DB가 유출되면 원문 토큰으로 아무 계정의 비밀번호나 바꿀 수 있다.
   * 비밀번호를 해시하는 것과 같은 이유다. 토큰은 32바이트 난수라
   * 사전 공격이 불가능하므로 salt 없는 sha256으로 충분하다.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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
