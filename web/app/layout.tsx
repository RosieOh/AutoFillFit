import { ToastProvider } from '@/components/ui/toast';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoFill-Fit — 내 이력서',
  description:
    '한 번 저장한 이력서로 채용 지원서를 자동으로 채웁니다. 인적사항, 학력·경력, 자격증, 마스터 자소서를 한곳에서 관리하세요.',
};

export const viewport: Viewport = {
  themeColor: '#f8fafc',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard가 라틴·숫자까지 모두 렌더한다 — 실측 결과 Inter는 한 글자도 쓰이지 않아 제거했다. */}
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
