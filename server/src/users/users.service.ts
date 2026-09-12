import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Profile } from './entities/profile.entity';
import { User } from './entities/user.entity';
import { Resume } from '../resume/entities/resume.entity';

/**
 * 내보내기 파일의 형태.
 *
 * 개인정보보호법 제35조(열람 요구권)에 대응한다. 사람이 읽을 수 있어야 하므로
 * 내부 id나 FK 대신 실제 내용만 담는다.
 */
export interface MyDataExport {
  exportedAt: string;
  account: {
    email: string;
    joinedAt: Date;
    termsAgreedAt: Date | null;
    privacyAgreedAt: Date | null;
    policyVersion: string | null;
  };
  profile: {
    name: string | null;
    phone: string | null;
    birthdate: string | null;
    address: string | null;
    zipCode: string | null;
  } | null;
  resume: {
    headline: string | null;
    education: unknown[];
    careers: unknown[];
    certificates: unknown[];
    essays: unknown[];
    skills: unknown;
    extra: unknown;
    updatedAt: Date;
  } | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
  ) {}

  /** 내 데이터 전체를 한 파일로 모은다. */
  async exportMyData(userId: string): Promise<MyDataExport> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const [profile, resume] = await Promise.all([
      this.profileRepository.findOne({ where: { userId } }),
      this.resumeRepository.findOne({
        where: { userId },
        order: { isPrimary: 'DESC', updatedAt: 'DESC' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        joinedAt: user.createdAt,
        termsAgreedAt: user.termsAgreedAt,
        privacyAgreedAt: user.privacyAgreedAt,
        policyVersion: user.policyVersion,
      },
      profile: profile
        ? {
            name: profile.name,
            phone: profile.phone,
            birthdate: profile.birthdate,
            address: profile.address,
            zipCode: profile.zipCode,
          }
        : null,
      resume: resume
        ? {
            headline: resume.headline,
            education: resume.education ?? [],
            careers: resume.careers ?? [],
            certificates: resume.certificates ?? [],
            essays: resume.essays ?? [],
            skills: resume.skills ?? null,
            extra: resume.extra ?? null,
            updatedAt: resume.updatedAt,
          }
        : null,
    };
  }

  /**
   * 계정과 딸린 데이터를 지운다.
   *
   * 개인정보보호법 제36조(삭제 요구권). 지금까지는 관리자에게 부탁하는 길밖에
   * 없었고 그 연락 창구도 없었다 — 한 번 가입하면 나갈 방법이 없는 구조였다.
   *
   * 되돌릴 수 없으므로 비밀번호를 다시 확인한다.
   * profiles·resumes는 FK의 ON DELETE CASCADE로 함께 지워진다.
   */
  async deleteMe(userId: string, password: string): Promise<{ deleted: true }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      throw new UnauthorizedException('비밀번호가 올바르지 않습니다.');
    }

    await this.userRepository.delete(user.id);

    return { deleted: true };
  }
}
