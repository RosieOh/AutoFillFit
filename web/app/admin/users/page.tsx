'use client';

import { formatDate, RoleBadge, StatusBadge } from '@/components/admin/badges';
import { api, toErrorMessage } from '@/lib/axios';
import {
  type AdminUserRow,
  type Paginated,
  type UserRole,
} from '@/types/admin';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Search,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type SortField = 'createdAt' | 'completeness' | 'email';

export default function AdminUsersPage() {
  const [data, setData] = useState<Paginated<AdminUserRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [sort, setSort] = useState<SortField>('createdAt');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: result } = await api.get<Paginated<AdminUserRow>>(
        '/admin/users',
        {
          params: {
            page,
            limit: 20,
            sort,
            order: 'desc',
            ...(search ? { q: search } : {}),
            ...(role ? { role } : {}),
          },
        },
      );
      setData(result);
    } catch (err) {
      setError(toErrorMessage(err, '사용자 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [page, search, role, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  };

  return (
    <>
      <header className="border-b border-slate-200/80 bg-slate-50/85 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              사용자
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {data ? `${data.total.toLocaleString()}명` : '불러오는 중'}
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            이름 · 이메일 마스킹됨
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-6 py-6">
        {/* 필터는 표 위 한 줄에 모은다. */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={onSearch} className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이메일로 검색"
              aria-label="이메일로 검색"
              className="input pl-9"
            />
          </form>

          <select
            value={role}
            onChange={(event) => {
              setPage(1);
              setRole(event.target.value as UserRole | '');
            }}
            aria-label="권한 필터"
            className="input w-auto"
          >
            <option value="">모든 권한</option>
            <option value="USER">일반</option>
            <option value="ADMIN">관리자</option>
          </select>

          <select
            value={sort}
            onChange={(event) => {
              setPage(1);
              setSort(event.target.value as SortField);
            }}
            aria-label="정렬 기준"
            className="input w-auto"
          >
            <option value="createdAt">가입 최신순</option>
            <option value="completeness">완성도 높은순</option>
            <option value="email">이메일순</option>
          </select>
        </div>

        {error ? (
          <div className="card" role="alert">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  목록을 불러오지 못했습니다
                </h2>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
              </div>
            </div>
          </div>
        ) : loading && !data ? (
          <TableSkeleton />
        ) : data && data.items.length === 0 ? (
          <div className="card flex flex-col items-center py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Users className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-900">
              조건에 맞는 사용자가 없습니다
            </p>
            <p className="mt-1 text-sm text-slate-500">
              검색어나 필터를 바꿔 보세요.
            </p>
          </div>
        ) : (
          <>
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-left">
                      <Th>사용자</Th>
                      <Th>권한</Th>
                      <Th>상태</Th>
                      <Th className="w-40">완성도</Th>
                      <Th>가입일</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="block min-w-0"
                          >
                            <span className="block truncate font-medium text-slate-900">
                              {user.name ?? '이름 없음'}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {user.email}
                            </span>
                            {/* 마스킹된 이메일만으로는 행을 구분할 수 없다. */}
                            <span className="tabular mt-0.5 block text-[11px] text-slate-500">
                              ID {user.id.slice(0, 8)}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge isActive={user.isActive} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-600"
                                style={{ width: `${user.completeness}%` }}
                              />
                            </div>
                            <span className="tabular text-xs font-medium text-slate-700">
                              {user.completeness}%
                            </span>
                          </div>
                        </td>
                        <td className="tabular whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data && data.totalPages > 1 ? (
              <div className="flex items-center justify-between">
                <p className="tabular text-xs text-slate-500">
                  {data.page} / {data.totalPages} 페이지
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={data.page <= 1}
                    className="btn-ghost px-3 py-2"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(p + 1, data.totalPages))
                    }
                    disabled={data.page >= data.totalPages}
                    className="btn-ghost px-3 py-2"
                  >
                    다음
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-medium text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}

function TableSkeleton() {
  return (
    <div className="card space-y-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-9 flex-1 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
