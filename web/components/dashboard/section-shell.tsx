'use client';

import { ChevronDown, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: SectionCardProps) {
  return (
    <section className="card animate-panel-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * 반복 항목 한 건을 감싸는 껍데기.
 * 항목이 늘면 폼이 무한히 길어지므로, 이미 작성된 항목은 접어서 요약만 보여준다.
 */
export function RepeatableItem({
  index,
  label,
  summary,
  onRemove,
  children,
}: {
  index: number;
  label: string;
  /** 접었을 때 보여줄 한 줄 요약 — 비어 있으면 새 항목으로 보고 펼친다. */
  summary?: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!summary);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="-my-1 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
              open ? '' : '-rotate-90'
            }`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label} {index + 1}
          </span>
          {!open && summary ? (
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
              {summary}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          삭제
        </button>
      </div>

      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost">
      <Plus className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

/** 항목이 하나도 없을 때 — 다음 행동을 명확히 제시한다. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
        <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

/** 2열 그리드 — 좁은 화면에서는 1열로 접힌다. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
      {children}
    </div>
  );
}
