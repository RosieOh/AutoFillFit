'use client';

import { api, toErrorMessage } from '@/lib/axios';
import {
  ADMIN_ACTION_LABELS,
  USER_ROLE_LABELS,
  type AdminAuditLog,
  type Paginated,
  type UserRole,
} from '@/types/admin';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserX,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const ACTION_ICONS = {
  REVEAL_PII: Eye,
  UPDATE_ROLE: ShieldCheck,
  UPDATE_STATUS: UserX,
  DELETE_USER: Trash2,
} as const;

export default function AdminAuditPage() {
  const [data, setData] = useState<Paginated<AdminAuditLog> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: result } = await api.get<Paginated<AdminAuditLog>>(
        '/admin/audit-logs',
        { params: { page, limit: 30 } },
      );
      setData(result);
    } catch (err) {
      setError(toErrorMessage(err, '감사 로그를 불러오지 못했습니다.'));
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="border-b border-slate-200/80 bg-slate-50/85 px-6 py-5 backdrop-blur">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            감사 로그
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            개인정보 열람과 계정 변경 기록입니다. 삭제하거나 수정할 수 없습니다.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-6 py-6">
        {error ? (
          <div className="card" role="alert">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  불러오지 못했습니다
                </h2>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
              </div>
            </div>
          </div>
        ) : !data ? (
          <div className="card space-y-3" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded bg-slate-100"
              />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="card flex flex-col items-center py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <ScrollText className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-900">
              아직 기록이 없습니다
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              관리자가 개인정보를 열람하거나 계정을 변경하면 여기에 남습니다.
            </p>
          </div>
        ) : (
          <>
            <ul className="card space-y-0 p-0">
              {data.items.map((log) => {
                const Icon = ACTION_ICONS[log.action] ?? ScrollText;
                const isReveal = log.action === 'REVEAL_PII';

                return (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 last:border-0"
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isReveal ? 'bg-amber-50' : 'bg-slate-100'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          isReveal ? 'text-amber-600' : 'text-slate-500'
                        }`}
                        aria-hidden="true"
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{log.actorEmail}</span>
                        <span className="text-slate-500">
                          {' '}
                          → {ADMIN_ACTION_LABELS[log.action]}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        대상 {log.targetEmail ?? '알 수 없음'}
                        {formatDetail(log)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tabular text-xs text-slate-500">
                        {formatDateTime(log.createdAt)}
                      </p>
                      {log.ipAddress ? (
                        <p className="tabular mt-0.5 text-xs text-slate-500">
                          {log.ipAddress}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {data.totalPages > 1 ? (
              <div className="flex items-center justify-between">
                <p className="tabular text-xs text-slate-500">
                  {data.page} / {data.totalPages} 페이지 · 전체{' '}
                  {data.total.toLocaleString()}건
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

function formatDetail(log: AdminAuditLog): string {
  const detail = log.detail;
  if (!detail) return '';

  if (log.action === 'UPDATE_ROLE') {
    return ` · ${roleLabel(detail.from)} → ${roleLabel(detail.to)}`;
  }
  if (log.action === 'UPDATE_STATUS') {
    return ` · ${detail.from ? '활성' : '비활성'} → ${
      detail.to ? '활성' : '비활성'
    }`;
  }
  if (log.action === 'REVEAL_PII' && Array.isArray(detail.fields)) {
    return ` · ${(detail.fields as string[]).map(fieldLabel).join(', ')}`;
  }
  return '';
}

function roleLabel(value: unknown): string {
  return USER_ROLE_LABELS[value as UserRole] ?? String(value);
}

const FIELD_LABELS: Record<string, string> = {
  profile: '인적사항',
  essays: '자소서 본문',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
