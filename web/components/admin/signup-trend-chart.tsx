'use client';

import { useState } from 'react';

interface Point {
  date: string;
  count: number;
}

/**
 * 최근 30일 일별 가입자 수.
 * 단일 계열이라 색은 정보를 나르지 않는다 — 길이가 값이고 색은 하나다.
 * (순차 램프를 쓰면 밝은 단계가 배경 대비 3:1을 넘지 못해 읽히지 않는다.)
 */
export function SignupTrendChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((point) => point.count), 1);
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <section className="card" aria-labelledby="trend-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="trend-heading" className="text-sm font-medium text-slate-500">
            최근 30일 가입
          </h2>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-3xl font-semibold tracking-tight text-slate-900">
              {total.toLocaleString()}
            </span>
            <span className="text-sm text-slate-500">명</span>
          </p>
        </div>

        {/* 값 하나를 직접 라벨로 — 모든 막대에 숫자를 붙이지 않는다. */}
        <p className="text-xs text-slate-500">
          하루 최대{' '}
          <span className="tabular font-medium text-slate-900">{max}명</span>
        </p>
      </div>

      <div className="relative mt-5">
        <div
          className="flex h-32 items-end gap-[2px]"
          role="img"
          aria-label={`최근 30일 일별 가입자 수. 총 ${total}명, 하루 최대 ${max}명.`}
        >
          {data.map((point, index) => {
            const ratio = point.count / max;
            const isHovered = hover === index;

            return (
              <div
                key={point.date}
                className="group relative flex h-full flex-1 cursor-default items-end"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                tabIndex={0}
              >
                {/* 값이 0인 날도 자리를 차지해야 시간축이 왜곡되지 않는다. */}
                <div
                  className={`w-full rounded-t transition-colors ${
                    point.count === 0
                      ? 'bg-slate-100'
                      : isHovered
                        ? 'bg-blue-700'
                        : 'bg-blue-600'
                  }`}
                  style={{
                    height:
                      point.count === 0 ? '2px' : `${Math.max(ratio * 100, 4)}%`,
                  }}
                />

                {isHovered ? (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <span className="tabular font-medium">
                      {formatDate(point.date)}
                    </span>
                    <span className="ml-1.5 text-slate-300">
                      {point.count}명
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span className="tabular">{formatDate(data[0]?.date)}</span>
          <span className="tabular">{formatDate(data.at(-1)?.date)}</span>
        </div>
      </div>
    </section>
  );
}

function formatDate(date: string | undefined): string {
  if (!date) return '';
  const [, month, day] = date.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}
