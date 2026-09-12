import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';

/**
 * 약관·처리방침의 공통 틀.
 *
 * 두 문서는 가입 화면에서 새 탭으로 열린다. 대시보드 레이아웃(사이드바·헤더)을
 * 그대로 쓰면 로그인하지 않은 사람에게 빈 껍데기가 보이므로 따로 둔다.
 */
export function PolicyPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  /** 이 문서의 버전. 서버가 동의 시점에 저장하는 값과 같은 날짜를 쓴다. */
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Zap className="h-4.5 w-4.5 text-white" aria-hidden="true" />
            </span>
            AutoFill-Fit
          </Link>

          <Link
            href="/login"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            돌아가기
          </Link>
        </div>

        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <header className="border-b border-slate-200/80 pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              시행일 {updatedAt}
            </p>
          </header>

          <div className="flex flex-col gap-7 pt-6">{children}</div>
        </article>
      </div>
    </main>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-600 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-slate-900 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </section>
  );
}
