'use client';

import { USER_ROLE_LABELS, type UserRole } from '@/types/admin';

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${
        role === 'ADMIN'
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      {USER_ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${
        isActive ? 'text-slate-600' : 'text-rose-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
        aria-hidden="true"
      />
      {isActive ? '활성' : '비활성'}
    </span>
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
