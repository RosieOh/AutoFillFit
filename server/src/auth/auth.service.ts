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
      },
    });

    // 계정 존재 여부가 응답 시간으로 새지 않도록 더미 해시와 비교한다.
    const hash =
      user?.password ??
      '$2b$12$0000000000000000000000000000000000000000000000000000';
    const matched = await bcrypt.compare(dto.password, hash);

    if (!user || !matched) {
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

    return this.buildAuthResponse(user);
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
