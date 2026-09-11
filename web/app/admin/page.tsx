'use client';

import { SignupTrendChart } from '@/components/admin/signup-trend-chart';
import { api, toErrorMessage } from '@/lib/axios';
import type { AdminStats, SectionBreakdown } from '@/types/admin';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const SECTION_LABELS: Record<keyof SectionBreakdown, string> = {
  profile: '기본 인적사항',
  history: '학력 / 경력',
  certificates: '자격증',
  essays: '마스터 자소서',
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<AdminStats>('/admin/stats');
      setStats(data);
    } catch (err) {
      setError(toErrorMessage(err, '지표를 불러오지 못했습니다.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="border-b border-slate-200/80 bg-slate-50/85 px-6 py-5 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            개요
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            가입 현황과 이력서 작성 수준을 집계한 값입니다. 개인정보는 포함되지
            않습니다.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-6">
        {error ? (
          <ErrorPanel message={error} onRetry={() => void load()} />
        ) : !stats ? (
          <OverviewSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                label="전체 사용자"
                value={stats.totals.users}
                unit="명"
                sub={`활성 ${stats.totals.active} · 비활성 ${stats.totals.inactive}`}
              />
              <StatTile
                label="이력서 보유"
                value={stats.totals.withResume}
                unit="명"
                sub={`전체의 ${percent(stats.totals.withResume, stats.totals.users)}%`}
              />
              <StatTile
                label="평균 완성도"
                value={stats.completeness.average}
                unit="%"
                sub="100점 만점 기준"
              />
              <StatTile
                label="최근 7일 가입"
                value={stats.signups.last7Days}
                unit="명"
                sub={`30일 ${stats.signups.last30Days}명`}
              />
            </div>

            <SignupTrendChart data={stats.signupTrend} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <DistributionCard
                distribution={stats.completeness.distribution}
                totalUsers={stats.totals.users}
              />
              <SectionAveragesCard
                averages={stats.completeness.sectionAverages}
                weights={stats.completeness.sectionWeights}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}

function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function StatTile({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="tabular text-2xl font-semibold tracking-tight text-slate-900">
          {value.toLocaleString()}
        </span>
        <span className="text-sm text-slate-500">{unit}</span>
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>
    </div>
  );
}

/** 완성도 구간별 사용자 수 — 값은 막대 길이, 색은 단일 hue */
function DistributionCard({
  distribution,
  totalUsers,
}: {
  distribution: { bucket: string; count: number }[];
  totalUsers: number;
}) {
  const max = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <section className="card" aria-labelledby="distribution-heading">
      <h2
        id="distribution-heading"
        className="text-sm font-medium text-slate-500"
      >
        완성도 분포
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        구간별 사용자 수 · 전체 {totalUsers.toLocaleString()}명
      </p>

      <ul className="mt-5 space-y-3">
        {distribution.map((item) => (
          <li key={item.bucket} className="flex items-center gap-3">
            <span className="tabular w-16 shrink-0 text-xs text-slate-500">
              {item.bucket}%
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
            <span className="tabular w-12 shrink-0 text-right text-xs font-medium text-slate-900">
              {item.count}명
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 섹션별 평균 획득 점수 — 배점(track) 대비 평균(fill) */
function SectionAveragesCard({
  averages,
  weights,
}: {
  averages: SectionBreakdown;
  weights: SectionBreakdown;
}) {
  const keys = Object.keys(SECTION_LABELS) as (keyof SectionBreakdown)[];

  return (
    <section className="card" aria-labelledby="sections-heading">
      <h2 id="sections-heading" className="text-sm font-medium text-slate-500">
        어디에서 점수가 빠지는가
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        섹션별 평균 획득 점수 / 배점
      </p>

      <ul className="mt-5 space-y-3">
        {keys.map((key) => {
          const earned = averages[key];
          const weight = weights[key];
          const ratio = weight ? (earned / weight) * 100 : 0;

          return (
            <li key={key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-slate-600">
                  {SECTION_LABELS[key]}
                </span>
                <span className="tabular shrink-0 text-xs font-medium text-slate-900">
                  {earned}
                  <span className="text-slate-500"> / {weight}</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${ratio}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 h-32 w-full animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="card" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            지표를 불러오지 못했습니다
          </h2>
          <p className="mt-1 text-sm text-slate-500">{message}</p>
          <button type="button" onClick={onRetry} className="btn-ghost mt-4">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
