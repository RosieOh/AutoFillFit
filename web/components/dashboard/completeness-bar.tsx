'use client';

import type { Completeness } from '@/lib/completeness';
import { NAV_ITEMS } from './sidebar';
import { ArrowRight } from 'lucide-react';

interface CompletenessBarProps {
  completeness: Completeness;
  onJump: (key: Completeness['sections'][number]['key']) => void;
}

export function CompletenessBar({
  completeness,
  onJump,
}: CompletenessBarProps) {
  const { total, weakest } = completeness;
  const weakestLabel = weakest
    ? NAV_ITEMS.find((item) => item.key === weakest.key)?.label
    : null;

  return (
    <section className="card" aria-labelledby="completeness-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="completeness-heading"
            className="text-sm font-medium text-slate-500"
          >
            내 이력 완성도
          </h2>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-4xl font-semibold tracking-tight text-slate-900">
              {total}%
            </span>
            <span className="text-sm text-slate-500">
              {total >= 100
                ? '모든 항목을 채웠습니다'
                : `${100 - total}% 남았습니다`}
            </span>
          </p>
        </div>

        {/* 남은 점수가 가장 큰 곳으로 바로 보낸다. */}
        {weakest && weakest.nextAction ? (
          <button
            type="button"
            onClick={() => onJump(weakest.key)}
            className="group flex w-full items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:w-auto"
          >
            {/* 한글이 단어 중간에서 끊기지 않도록 break-keep을 준다. */}
            <span className="whitespace-nowrap font-medium text-slate-900">
              {weakestLabel}
            </span>
            <span className="min-w-0 flex-1 break-keep text-slate-500">
              · {weakest.nextAction}
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      <div
        role="progressbar"
        aria-valuenow={total}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby="completeness-heading"
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
          style={{ width: `${total}%` }}
        />
      </div>

      {/* 퍼센트의 근거를 드러낸다 — 어디서 점수가 빠졌는지 보이게. */}
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {completeness.sections.map((section) => {
          const label = NAV_ITEMS.find(
            (item) => item.key === section.key,
          )?.label;
          const done = section.earned >= section.weight;

          return (
            <li key={section.key} className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  done
                    ? 'bg-blue-600'
                    : section.earned > 0
                      ? 'bg-blue-300'
                      : 'bg-slate-300'
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                {label}
              </span>
              <span className="tabular text-xs font-medium text-slate-700">
                {Math.round(section.earned)}
                <span className="text-slate-500">/{section.weight}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
