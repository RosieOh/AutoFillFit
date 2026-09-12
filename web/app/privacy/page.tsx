import Link from 'next/link';
import { PolicyPage, Section } from '@/components/policy-page';

export const metadata = { title: '개인정보 처리방침 · AutoFill-Fit' };

export default function PrivacyPage() {
  return (
    <PolicyPage title="개인정보 처리방침" updatedAt="2026-09-13">
      <Section title="1. 수집하는 항목">
        <p>서비스는 다음을 수집·보관합니다.</p>
        <ul>
          <li>
            <strong>필수</strong> — 이메일, 비밀번호(복호화 불가능한 형태)
          </li>
          <li>
            <strong>선택</strong> — 이름, 연락처, 생년월일, 주소, 우편번호
          </li>
          <li>
            <strong>선택</strong> — 학력, 경력, 자격증, 자기소개서 내용
          </li>
          <li>
            <strong>자동 생성</strong> — 가입 시각, 동의 시각과 약관 버전,
            로그인 실패 횟수
          </li>
        </ul>
        <p>
          선택 항목은 입력하지 않아도 서비스를 이용할 수 있습니다. 다만 입력한
          항목만 지원서에 자동으로 채워집니다.
        </p>
      </Section>

      <Section title="2. 이용 목적">
        <p>
          수집한 정보는 <strong>채용 지원서 자동 입력</strong>이라는 한 가지
          목적에만 사용합니다. 광고나 제3자 제공에 쓰지 않습니다.
        </p>
      </Section>

      <Section title="3. 보관 기간">
        <p>
          계정이 유지되는 동안 보관합니다. 탈퇴하면 계정·인적사항·이력서가 즉시
          삭제되며 복구할 수 없습니다.
        </p>
        <p>
          관리자의 개인정보 열람 기록은 부정 사용을 확인하기 위해 별도로
          보관합니다. 이 기록에는 열람한 관리자, 시각, 사유가 남습니다.
        </p>
      </Section>

      <Section title="4. 확장 프로그램과 데이터">
        <p>
          Chrome 확장 프로그램은 이 서비스의 서버를 직접 호출하지 않습니다.
          대시보드에서 <strong>&ldquo;이력서 전달&rdquo;</strong>을 눌렀을 때만,
          자동 입력에 필요한 값이 브라우저 안(<code>chrome.storage.local</code>)에
          저장됩니다.
        </p>
        <ul>
          <li>로그인 토큰은 확장에 전달되지 않습니다.</li>
          <li>전달된 값은 그 브라우저에만 남고 서버로 되돌아가지 않습니다.</li>
          <li>
            대시보드에서 로그아웃하면 확장에 남은 값도 함께 지워집니다.
          </li>
        </ul>
        <p>
          자동 입력은 이용자가 지원서 화면에서 버튼을 직접 눌렀을 때만
          실행됩니다.
        </p>
      </Section>

      <Section title="5. 이용자의 권리">
        <ul>
          <li>
            <strong>열람·내려받기</strong> — 대시보드에서 내 데이터 전체를 파일로
            내려받을 수 있습니다.
          </li>
          <li>
            <strong>정정</strong> — 대시보드에서 언제든 직접 수정할 수 있습니다.
          </li>
          <li>
            <strong>삭제</strong> — 대시보드에서 탈퇴하면 전부 삭제됩니다.
            관리자에게 요청할 필요가 없습니다.
          </li>
        </ul>
      </Section>

      <Section title="6. 관리자의 열람">
        <p>
          문의 대응이나 부정 사용 확인을 위해 관리자가 이용자 정보를 볼 수 있는
          백오피스가 있습니다. 다음 규칙이 적용됩니다.
        </p>
        <ul>
          <li>이름·연락처·주소 등은 기본적으로 가려진 상태로 보입니다.</li>
          <li>
            가려진 값을 보려면 <strong>사유를 선택해야</strong> 하고, 열람한
            사실이 기록으로 남습니다.
          </li>
          <li>기록에는 관리자, 대상, 시각, 사유, 접속 IP가 남습니다.</li>
        </ul>
      </Section>

      <Section title="7. 안전조치">
        <ul>
          <li>비밀번호는 bcrypt로 저장하며 원문을 보관하지 않습니다.</li>
          <li>
            로그인·가입 요청 횟수를 제한하고, 연속 실패 시 계정을 일시
            잠급니다.
          </li>
          <li>개인정보 열람은 관리자 권한을 가진 계정만 가능합니다.</li>
        </ul>
      </Section>

      <p className="pt-2 text-sm text-slate-500">
        서비스 이용 조건은{' '}
        <Link
          href="/terms"
          className="font-medium text-blue-600 underline underline-offset-2"
        >
          이용약관
        </Link>
        을 참고하세요.
      </p>
    </PolicyPage>
  );
}
