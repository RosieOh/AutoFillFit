'use client';

import { clearToken, getToken } from '@/lib/axios';
import { clearMeCache, useMe } from '@/lib/use-me';
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

const NAV = [
  { href: '/admin', label: '개요', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: '사용자', icon: Users, exact: false },
  { href: '/admin/audit', label: '감사 로그', icon: ScrollText, exact: false },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, state, isAdmin } = useMe();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login?next=%2Fadmin');
    }
  }, [router]);

  const handleSignOut = () => {
    clearToken();
    clearMeCache();
    router.replace('/login');
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-64 w-full animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  // 권한이 없는 사용자에게 백오피스의 구조 자체를 보여주지 않는다.
  if (state === 'ready' && !isAdmin) {
    return <NotAuthorized />;
  }

  // 로그인하지 않았으면 리다이렉트가 일어나기 전에도 셸을 그리지 않는다.
  if (state !== 'ready') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-64 w-full animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="flex h-full w-full flex-col border-slate-200/80 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-r">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <ShieldCheck className="h-4.5 w-4.5 text-white" aria-hidden="true" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              백오피스
            </span>
          </div>
        </div>

        <nav aria-label="백오피스" className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        active ? 'text-slate-900' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-slate-200/80 pt-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4.5 w-4.5 shrink-0 text-slate-400" aria-hidden="true" />
              내 이력서로
            </Link>
          </div>
        </nav>

        <div className="border-t border-slate-200/80 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold uppercase text-white">
              AD
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
              {me?.email ?? ''}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="로그아웃"
              className="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">{children}</div>
    </div>
  );
}

function NotAuthorized() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="card max-w-md text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
          <ShieldAlert className="h-5 w-5 text-slate-500" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
          백오피스 접근 권한이 없습니다
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          관리자 권한은 가입으로 얻을 수 없고, 서버에서{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-700">
            npm run admin:grant
          </code>
          {' '}으로 부여하거나 기존 관리자가 승격해야 합니다.
        </p>
        <Link href="/dashboard" className="btn-ghost mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />내 이력서로 돌아가기
        </Link>
      </div>
    </main>
  );
}
