import { UserRole } from '../users/entities/user.entity';
import dataSource from '../database/data-source';
import { User } from '../users/entities/user.entity';

/**
 * 최초 관리자를 만드는 유일한 경로.
 *   npm run admin:grant -- hong@example.com
 *   npm run admin:grant -- hong@example.com --revoke
 *
 * 회원가입 API로는 절대 ADMIN이 될 수 없고, 이후에는 기존 관리자가
 * 백오피스에서 승격할 수 있다.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase();
  const revoke = args.includes('--revoke');

  if (!email) {
    console.error('사용법: npm run admin:grant -- <email> [--revoke]');
    process.exitCode = 1;
    return;
  }

  await dataSource.initialize();

  try {
    const repository = dataSource.getRepository(User);
    const user = await repository.findOne({ where: { email } });

    if (!user) {
      console.error(`사용자를 찾을 수 없습니다: ${email}`);
      process.exitCode = 1;
      return;
    }

    const nextRole = revoke ? UserRole.USER : UserRole.ADMIN;

    if (user.role === nextRole) {
      console.log(`이미 ${nextRole} 입니다: ${email}`);
      return;
    }

    if (revoke) {
      const admins = await repository.count({
        where: { role: UserRole.ADMIN, isActive: true },
      });
      if (admins <= 1) {
        console.error('마지막 관리자의 권한은 회수할 수 없습니다.');
        process.exitCode = 1;
        return;
      }
    }

    user.role = nextRole;
    await repository.save(user);

    console.log(`${email} → ${nextRole}`);
  } finally {
    await dataSource.destroy();
  }
}

void main();
