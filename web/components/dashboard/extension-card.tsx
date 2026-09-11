'use client';

import type { ExtensionInfo } from '@/lib/extension-bridge';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Loader2,
  Puzzle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ExtensionCardProps {
  state: 'checking' | 'connected' | 'absent';
  info: ExtensionInfo | null;
  onSync: () => void;
  syncing: boolean;
  /** 확장이 응답하지 않거나 저장에 실패했을 때의 메시지 */
  syncError: string | null;
  /** 전달이 실제로 성공했을 때 호출 */
  onSynced: () => void;
  /** 이력서가 완성돼 확장을 쓸 준비가 됐는지 */
  ready: boolean;
  /** 동기화 이후 이력서가 바뀌었는지 */
  stale: boolean;
}

/**
 * 이 제품의 실체는 확장 프로그램이다.
 * 그런데 화면 어디에도 확장이 없으면 사용자는 자기가 채운 데이터가
 * 무슨 일을 하는지 끝까지 알 수 없고, 100%에 도달해도 다음 행동이 없다.
 */
export function ExtensionCard({
  state,
  info,
  onSync,
  syncing,
  syncError,
  ready,
  stale,
  onSynced,
}: ExtensionCardProps) {
  // syncedAt이 새로 생기면 전달이 성공한 것이다.
  const lastSyncedAt = useRef<string | null>(null);
  useEffect(() => {
    if (info?.syncedAt && info.syncedAt !== lastSyncedAt.current) {
      lastSyncedAt.current = info.syncedAt;
      onSynced();
    }
  }, [info?.syncedAt, onSynced]);

  if (state === 'checking') {
    return (
      <section className="card flex items-center gap-3">
        <Loader2
          className="h-4 w-4 animate-spin text-slate-400"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-500">확장 프로그램을 확인하는 중</p>
      </section>
    );
  }

  if (state === 'absent') {
    return (
      <section
        className={`card ${ready ? 'border-blue-200 bg-blue-50/50' : ''}`}
        aria-labelledby="extension-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <Zap className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="extension-heading"
                className="text-base font-semibold tracking-tight text-slate-900"
              >
                {ready
                  ? '이제 확장 프로그램을 설치하세요'
                  : 'Chrome 확장 프로그램이 지원서를 채웁니다'}
              </h2>
              <p className="mt-1 break-keep text-sm leading-relaxed text-slate-600">
                {ready
                  ? '이력서 준비가 끝났습니다. 확장을 설치하면 채용 사이트에서 버튼 한 번으로 채워집니다.'
                  : '여기 저장한 이력서를 확장이 읽어, 채용 사이트 지원서의 입력칸을 자동으로 채웁니다.'}
              </p>
            </div>
          </div>

          <a
            href="https://chromewebstore.google.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary shrink-0"
          >
            설치하기
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <details className="mt-4 border-t border-slate-200/80 pt-3">
          <summary className="cursor-pointer text-xs text-slate-500">
            개발 중이라면 — 압축해제된 확장으로 불러오는 방법
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-500">
            <li>
              Chrome에서{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">
                chrome://extensions
              </code>{' '}
              를 열고 개발자 모드를 켭니다.
            </li>
            <li>&ldquo;압축해제된 확장 프로그램을 로드&rdquo;로 저장소 루트를 선택합니다.</li>
            <li>이 페이지를 새로고침하면 연결 상태가 바뀝니다.</li>
          </ol>
        </details>
      </section>
    );
  }

  const last = info?.history?.[0] ?? null;

  return (
    <section className="card" aria-labelledby="extension-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Puzzle className="h-5 w-5 text-blue-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="extension-heading"
              className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-slate-900"
            >
              확장 프로그램 연결됨
              <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {last ? (
                <>
                  마지막 자동 채움{' '}
                  <span className="font-medium text-slate-900">{last.host}</span>{' '}
                  · {last.filled}칸 · {formatRelative(last.at)}
                </>
              ) : (
                '아직 자동으로 채운 지원서가 없습니다.'
              )}
            </p>
            <p className="tabular mt-1 text-xs text-slate-500">
              v{info?.version}
              {info?.syncedAt
                ? ` · 이력서 전달 ${formatRelative(info.syncedAt)}`
                : ' · 이력서가 아직 전달되지 않았습니다'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className={stale || !info?.syncedAt ? 'btn-primary shrink-0' : 'btn-ghost shrink-0'}
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              전달 중
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {info?.syncedAt ? '다시 전달' : '이력서 전달'}
            </>
          )}
        </button>
      </div>

      {syncError ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {syncError}
        </p>
      ) : null}

      {/* 저장만 하면 확장이 자동으로 아는 게 아니라는 점을 숨기지 않는다. */}
      {!syncError && stale ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          이력서를 저장한 뒤 아직 전달하지 않았습니다. 확장은 이전 내용을 사용합니다.
        </p>
      ) : null}

      {info?.history && info.history.length > 1 ? (
        <ul className="mt-4 space-y-1.5 border-t border-slate-200/80 pt-3">
          {info.history.slice(1).map((event, index) => (
            <li
              key={`${event.at}-${index}`}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="min-w-0 flex-1 truncate text-slate-600">
                {event.host}
              </span>
              <span className="tabular shrink-0 text-slate-500">
                {event.filled}칸 · {formatRelative(event.at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '방금';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(date);
}
