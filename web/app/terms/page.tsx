import Link from 'next/link';
import { PolicyPage, Section } from '@/components/policy-page';

export const metadata = { title: '이용약관 · AutoFill-Fit' };

export default function TermsPage() {
  return (
    <PolicyPage title="이용약관" updatedAt="2026-09-13">
      <Section title="제1조 (목적)">
        <p>
          이 약관은 AutoFill-Fit(이하 &ldquo;서비스&rdquo;)의 이용 조건과 절차,
          이용자와 서비스의 권리·의무를 정합니다.
        </p>
      </Section>

      <Section title="제2조 (서비스의 내용)">
        <p>
          서비스는 이용자가 저장한 이력서를 채용 사이트 지원서의 입력칸에
          자동으로 채워 넣는 기능을 제공합니다. 자동 입력은 이용자가 Chrome 확장
          프로그램에서 직접 버튼을 눌렀을 때만 실행됩니다.
        </p>
        <p>
          서비스는 지원서의 제출을 대행하지 않습니다. 제출 전 내용 확인과 제출
          행위는 이용자의 책임입니다.
        </p>
      </Section>

      <Section title="제3조 (계정)">
        <p>
          이용자는 이메일과 비밀번호로 계정을 만듭니다. 비밀번호는 복호화할 수
          없는 형태로 보관되며, 서비스도 원문을 알 수 없습니다.
        </p>
        <p>
          연속으로 로그인에 실패하면 계정이 일정 시간 잠깁니다. 타인의 무단
          접근을 막기 위한 조치입니다.
        </p>
      </Section>

      <Section title="제4조 (이용자의 의무)">
        <ul>
          <li>타인의 정보를 자신의 것처럼 등록하지 않습니다.</li>
          <li>서비스를 자동화 도구로 과도하게 호출하지 않습니다.</li>
          <li>지원서에 채워진 내용의 사실 여부는 이용자가 확인합니다.</li>
        </ul>
      </Section>

      <Section title="제5조 (자동 입력의 한계)">
        <p>
          채용 사이트의 구조는 사이트마다 다릅니다. 서비스는 문항을 찾지 못하거나
          답변이 글자수 제한을 넘으면 <strong>그 칸을 비워 둡니다.</strong> 잘못
          채워진 내용이 빈 칸보다 되돌리기 어렵기 때문입니다.
        </p>
        <p>
          비워 둔 칸은 지원서 화면에 표시로 남고 안내 문구로 알립니다. 제출 전
          확인은 이용자의 몫입니다.
        </p>
      </Section>

      <Section title="제6조 (계정 해지)">
        <p>
          이용자는 언제든지 대시보드에서 탈퇴할 수 있습니다. 탈퇴하면 계정과
          인적사항, 이력서가 모두 삭제되며 복구되지 않습니다. 탈퇴 전 데이터
          내려받기를 권합니다.
        </p>
      </Section>

      <Section title="제7조 (약관의 변경)">
        <p>
          약관이 변경되면 변경된 내용을 공지하고, 다음 로그인 시 다시 동의를
          받습니다. 동의한 시점의 약관 버전은 계정에 기록됩니다.
        </p>
      </Section>

      <p className="pt-2 text-sm text-slate-500">
        개인정보 처리에 관한 사항은{' '}
        <Link href="/privacy" className="font-medium text-blue-600 underline underline-offset-2">
          개인정보 처리방침
        </Link>
        을 참고하세요.
      </p>
    </PolicyPage>
  );
}
