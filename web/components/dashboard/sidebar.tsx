'use client';

import type { Completeness, SectionKey } from '@/lib/completeness';
import {
  Award,
  Check,
  FileText,
  GraduationCap,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

export interface NavItem {
  key: SectionKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'profile',
    label: '기본 인적사항',
    description: '이름 · 연락처 · 주소',
    icon: User,
  },
  {
    key: 'history',
    label: '학력 / 경력',
    description: '학교와 회사 이력',
    icon: GraduationCap,
  },
  {
    key: 'certificates',
    label: '자격증',
    description: '자격증 · 어학 점수',
    icon: Award,
  },
  {
    key: 'essays',
    label: '마스터 자소서',
    description: '문항별 답변',
    icon: FileText,
  },
];

interface SidebarProps {
  /** 관리자에게만 백오피스 진입점을 보여준다. */
  isAdmin: boolean;
  /** 불러오는 중에는 0/30 같은 값을 단언하지 않는다. */
  loading?: boolean;
  /** 저장하지 않은 변경이 있으면 화면을 떠나기 전에 확인한다. */
  isDirty?: boolean;
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  completeness: Completeness;
  email: string | null;
  onSignOut: () => void;
}

export function Sidebar({
  isAdmin,
  loading,
  isDirty,
  active,
  onSelect,
  completeness,
  email,
  onSignOut,
}: SidebarProps) {
  return (
    <aside className="hidden h-full w-full flex-col border-slate-200/80 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:border-r">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Zap className="h-4.5 w-4.5 text-white" aria-hidden="true" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">
          AutoFill-Fit
        </span>
      </div>

      <nav aria-label="이력서 항목" className="flex-1 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const section = completeness.sections.find(
              (candidate) => candidate.key === item.key,
            );
            const done = section ? section.earned >= section.weight : false;
            const isActive = item.key === active;
            const Icon = item.icon;

            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 ${
                      isActive
                        ? 'text-blue-600'
                        : 'text-slate-400 group-hover:text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.label}
                    </span>
                    <span
                      className={`block truncate text-xs ${
                        isActive ? 'text-blue-800' : 'text-slate-500'
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>

                  {/* 어느 항목이 남았는지 탭을 열지 않고도 알 수 있게 한다. */}
                  {loading ? (
                    <span className="h-3 w-8 shrink-0 animate-pulse rounded bg-slate-200" />
                  ) : done ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-blue-600"
                      aria-label="작성 완료"
                    />
                  ) : (
                    <span
                      className="tabular shrink-0 text-xs font-medium text-slate-500"
                      aria-label={`${item.label} ${Math.round(
                        section?.earned ?? 0,
                      )}점 획득, 배점 ${section?.weight ?? 0}점`}
                    >
                      {Math.round(section?.earned ?? 0)}/{section?.weight ?? 0}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200/80 p-3">
        {/* 관리자에게만 보인다 — 일반 사용자에게는 백오피스의 존재를 노출하지 않는다. */}
        {isAdmin ? (
          <Link
            href="/admin"
            onClick={(event) => {
              if (
                isDirty &&
                !window.confirm(
                  '저장하지 않은 변경사항이 있습니다. 백오피스로 이동하면 사라집니다. 계속할까요?',
                )
              ) {
                event.preventDefault();
              }
            }}
            className="mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <ShieldCheck
              className="h-4.5 w-4.5 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            백오피스
          </Link>
        ) : null}

        {/*
          계정 삭제와 데이터 내려받기로 가는 길.
          여기 없으면 사용자는 나갈 방법을 찾지 못한다.
        */}
        <Link
          href="/account"
          onClick={(event) => {
            if (
              isDirty &&
              !window.confirm(
                '저장하지 않은 변경사항이 있습니다. 계정 화면으로 이동하면 사라집니다. 계속할까요?',
              )
            ) {
              event.preventDefault();
            }
          }}
          className="mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <Settings
            className="h-4.5 w-4.5 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          계정
        </Link>

        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-600">
            {email ? email.slice(0, 2) : '--'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
            {email ?? '불러오는 중'}
          </span>
          <button
            type="button"
            // 확인 창은 onSignOut(페이지) 한 곳에서만 띄운다. 여기서도 띄우면 두 번 뜬다.
            onClick={onSignOut}
            aria-label="로그아웃"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * 좁은 화면에서는 세로 사이드바가 화면 상단 750px를 차지해
 * 섹션을 바꿀 때마다 최상단까지 스크롤해야 했다.
 * 헤더 안에 들어가는 가로 스트립으로 대체한다.
 */
export function MobileSectionTabs({
  active,
  onSelect,
  completeness,
  loading,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  completeness: Completeness;
  loading?: boolean;
}) {
  return (
    <nav
      aria-label="이력서 항목"
      className="-mx-6 overflow-x-auto px-6 lg:hidden"
    >
      <ul className="flex w-max gap-2 pb-1">
        {NAV_ITEMS.map((item) => {
          const section = completeness.sections.find(
            (candidate) => candidate.key === item.key,
          );
          const done = section ? section.earned >= section.weight : false;
          const isActive = item.key === active;
          const Icon = item.icon;

          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                {item.label}
                {loading ? null : done ? (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-blue-600"
                    aria-label="작성 완료"
                  />
                ) : (
                  <span className="tabular text-xs text-slate-500">
                    {Math.round(section?.earned ?? 0)}/{section?.weight ?? 0}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
