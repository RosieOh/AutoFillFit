'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** 입력해야 실행되는 문구 — 되돌릴 수 없는 작업에만 지정한다. */
  requirePhrase?: string;
  /** 선택해야 실행되는 사유 — 기록이 남아야 하는 작업에 쓴다. */
  requireReason?: { label: string; options: { value: string; label: string }[] };
  pending?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  /** 파괴적이지 않은 확인은 위험 색을 쓰지 않는다. */
  tone?: 'danger' | 'neutral';
}

/**
 * 되돌릴 수 없는 작업에만 쓴다.
 * 취소 가능한 변경까지 모달로 막으면 확인 절차가 의미를 잃는다.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  requirePhrase,
  requireReason,
  pending,
  onConfirm,
  onCancel,
  tone = 'danger',
}: ConfirmDialogProps) {
  const [phrase, setPhrase] = useState('');
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setPhrase('');
      setReason('');
      return;
    }

    // 포커스를 다이얼로그 안으로 옮기고 Esc로 닫을 수 있게 한다.
    const target = requireReason
      ? document.getElementById('confirm-reason')
      : requirePhrase
        ? inputRef.current
        : cancelRef.current;
    (target as HTMLElement | null)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, requirePhrase, requireReason, onCancel]);

  if (!open) return null;

  const canConfirm =
    (!requirePhrase || phrase.trim() === requirePhrase) &&
    (!requireReason || reason !== '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="card w-full max-w-md animate-panel-in"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger' ? 'bg-rose-50' : 'bg-amber-50'
            }`}
          >
            <AlertTriangle
              className={`h-4.5 w-4.5 ${
                tone === 'danger' ? 'text-rose-600' : 'text-amber-600'
              }`}
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-title"
              className="text-base font-semibold text-slate-900"
            >
              {title}
            </h2>
            <p
              id="confirm-description"
              className="mt-1 text-sm leading-relaxed text-slate-500"
            >
              {description}
            </p>
          </div>
        </div>

        {requireReason ? (
          <div className="mt-4">
            <label
              htmlFor="confirm-reason"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {requireReason.label}
            </label>
            <select
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="input"
            >
              <option value="">선택해 주세요</option>
              {requireReason.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {requirePhrase ? (
          <div className="mt-4">
            <label
              htmlFor="confirm-phrase"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              계속하려면{' '}
              <span className="font-semibold text-slate-900">
                {requirePhrase}
              </span>
              를 입력하세요
            </label>
            <input
              ref={inputRef}
              id="confirm-phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              className="input"
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="btn-ghost"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason || undefined)}
            disabled={!canConfirm || pending}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 ${
              tone === 'danger'
                ? 'bg-rose-600 enabled:hover:bg-rose-700 focus-visible:ring-rose-400'
                : 'bg-blue-600 enabled:hover:bg-blue-700 focus-visible:ring-blue-500/60'
            }`}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                처리 중
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
