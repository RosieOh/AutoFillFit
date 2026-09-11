'use client';

import { formatDate, RoleBadge, StatusBadge } from '@/components/admin/badges';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { api, toErrorMessage } from '@/lib/axios';
import { useMe } from '@/lib/use-me';
import {
  EDUCATION_DEGREE_LABELS,
  ESSAY_TYPE_LABELS,
} from '@/types/resume';
import type { AdminUserDetail, SectionBreakdown } from '@/types/admin';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';


const SECTION_LABELS: Record<keyof SectionBreakdown, string> = {
  profile: '기본 인적사항',
  history: '학력 / 경력',
  certificates: '자격증',
  essays: '마스터 자소서',
};

/**
 * 마스킹된 이메일은 목록에서 서로 구분되지 않는다(us****@example.com이 수십 명).
 * 되돌릴 수 없는 작업의 확인 문구에는 마스킹되지 않는 식별자가 필요하다.
 */
/** server/src/admin/dto/admin.dto.ts의 RevealReason과 같은 값 */
const REVEAL_REASON_LABELS = {
  SUPPORT: '문의 대응',
  ABUSE_REPORT: '신고 조사',
  USER_REQUEST: '본인 요청',
} as const;

function shortId(id: string): string {
  return id.slice(0, 8);
}

/** 배점 — server/src/admin/utils/completeness.util.ts와 같은 값 */
const SECTION_WEIGHTS: SectionBreakdown = {
  profile: 30,
  history: 40,
  certificates: 10,
  essays: 20,
};

/**
 * 신입(경력 없음 선언)은 경력 20점이 만점에서 빠진다.
 * 이걸 반영하지 않으면 "완성도 100%"인데 "학력·경력 20 / 40"이 함께 나온다.
 */
function sectionWeight(
  key: keyof SectionBreakdown,
  careerExcluded: boolean,
): number {
  if (key === 'history' && careerExcluded) return SECTION_WEIGHTS.history - 20;
  return SECTION_WEIGHTS[key];
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { me } = useMe();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [pendingAction, setPendingAction] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'reveal' | null>(null);

  const load = useCallback(
    async (reveal: boolean, reason?: string) => {
      setError(null);
      try {
        const { data } = await api.get<AdminUserDetail>(
          `/admin/users/${params.id}`,
          { params: reveal ? { reveal: true, reason } : {} },
        );
        setDetail(data);
        return true;
      } catch (err) {
        setError(toErrorMessage(err, '사용자를 불러오지 못했습니다.'));
        return false;
      }
    },
    [params.id],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleReveal = async (reason?: string) => {
    setRevealing(true);
    try {
      // load()는 실패를 error 상태로만 남기므로 성공 여부를 직접 확인해야 한다.
      const ok = await load(true, reason);
      if (!ok) {
        toast({
          variant: 'error',
          title: '열람하지 못했습니다',
          description: '잠시 후 다시 시도해 주세요.',
        });
        return;
      }
      setConfirm(null);
      toast({
        variant: 'success',
        title: '개인정보를 열람했습니다',
        description: `사유 "${
          REVEAL_REASON_LABELS[reason as keyof typeof REVEAL_REASON_LABELS] ??
          reason
        }"와 함께 감사 로그에 기록되었습니다.`,
      });
    } finally {
      setRevealing(false);
    }
  };

  const handleUpdate = async (patch: { role?: string; isActive?: boolean }) => {
    setPendingAction(true);
    try {
      await api.patch(`/admin/users/${params.id}`, patch);
      await load(false);
      toast({ variant: 'success', title: '변경했습니다' });
    } catch (err) {
      toast({
        variant: 'error',
        title: '변경하지 못했습니다',
        description: toErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
      });
    } finally {
      setPendingAction(false);
    }
  };

  const handleDelete = async () => {
    setPendingAction(true);
    try {
      await api.delete(`/admin/users/${params.id}`);
      toast({
        variant: 'success',
        title: '계정을 삭제했습니다',
        description: '프로필과 이력서도 함께 삭제되었습니다.',
      });
      router.replace('/admin/users');
    } catch (err) {
      toast({
        variant: 'error',
        title: '삭제하지 못했습니다',
        description: toErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
      });
      setPendingAction(false);
      setConfirm(null);
    }
  };

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-6">
        <div className="card" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                사용자를 불러오지 못했습니다
              </h1>
              <p className="mt-1 text-sm text-slate-500">{error}</p>
              <Link href="/admin/users" className="btn-ghost mt-4 inline-flex">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                목록으로
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-6 py-6" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-48 w-full animate-pulse rounded-2xl bg-white" />
      </main>
    );
  }

  const { user, profile, resume, completeness, masked } = detail;
  const isSelf = me?.id === user.id;

  return (
    <>
      <header className="border-b border-slate-200/80 bg-slate-50/85 px-6 py-5 backdrop-blur">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/admin/users"
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded px-2 text-xs text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            사용자 목록
          </Link>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                {profile?.name ?? '이름 없음'}
              </h1>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {user.email}
                <span className="tabular ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                  ID {shortId(user.id)}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <RoleBadge role={user.role} />
              <StatusBadge isActive={user.isActive} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-6 py-6">
        {/* 마스킹 상태와 해제 경로를 화면 맨 위에 명시한다. */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            masked
              ? 'border-slate-200 bg-white'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <p className="flex items-center gap-2 text-sm">
            {masked ? (
              <>
                <EyeOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="text-slate-600">
                  이름 · 연락처 · 생년월일 · 주소 · 자소서 본문이 가려져 있습니다.
                  학력 · 경력 · 자격증은 그대로 표시됩니다.
                </span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span className="text-amber-900">
                  원본을 표시 중입니다. 이 열람은 감사 로그에 기록되었습니다.
                </span>
              </>
            )}
          </p>

          {masked ? (
            <button
              type="button"
              onClick={() => setConfirm('reveal')}
              disabled={revealing}
              className="btn-ghost px-3 py-2"
            >
              {revealing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              원본 보기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void load(false)}
              className="btn-ghost px-3 py-2"
            >
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              다시 가리기
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="card lg:col-span-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              기본 인적사항
            </h2>
            {profile ? (
              <dl className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                <Detail label="이름" value={profile.name} />
                <Detail label="연락처" value={profile.phone} mono />
                <Detail label="생년월일" value={profile.birthdate} mono />
                <Detail label="우편번호" value={profile.zipCode} mono />
                <Detail label="주소" value={profile.address} wide />
              </dl>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                작성된 인적사항이 없습니다.
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="text-sm font-medium text-slate-500">이력 완성도</h2>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {completeness.total}%
            </p>
            <ul className="mt-4 space-y-2">
              {(
                Object.keys(SECTION_LABELS) as (keyof SectionBreakdown)[]
              ).map((key) => (
                <li key={key} className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-slate-500">
                    {SECTION_LABELS[key]}
                  </span>
                  <span className="tabular shrink-0 text-xs font-medium text-slate-700">
                    {Math.round(completeness.sections[key])}
                    <span className="text-slate-500">
                      {' / '}
                      {sectionWeight(key, completeness.careerExcluded)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              가입 {formatDate(user.createdAt)}
            </p>
          </section>
        </div>

        {resume ? (
          <>
            <section className="card">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                학력 · 경력 · 자격증
              </h2>

              <div className="mt-5 space-y-5">
                <Group label="학력" empty="등록된 학력이 없습니다.">
                  {resume.education.map((item, index) => (
                    <Row
                      key={index}
                      title={item.schoolName}
                      meta={[
                        item.major,
                        item.degree
                          ? EDUCATION_DEGREE_LABELS[item.degree]
                          : null,
                        item.admissionDate && item.graduationDate
                          ? `${item.admissionDate} ~ ${item.graduationDate}`
                          : null,
                      ]}
                    />
                  ))}
                </Group>

                <Group label="경력" empty="등록된 경력이 없습니다.">
                  {resume.careers.map((item, index) => (
                    <Row
                      key={index}
                      title={item.companyName}
                      meta={[
                        item.jobTitle,
                        item.department,
                        item.joinDate
                          ? `${item.joinDate} ~ ${
                              item.isCurrent ? '재직 중' : (item.leaveDate ?? '')
                            }`
                          : null,
                      ]}
                    />
                  ))}
                </Group>

                <Group label="자격증" empty="등록된 자격증이 없습니다.">
                  {resume.certificates.map((item, index) => (
                    <Row
                      key={index}
                      title={item.name}
                      meta={[item.issuer, item.acquiredAt, item.score]}
                    />
                  ))}
                </Group>
              </div>
            </section>

            <section className="card">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                마스터 자소서
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                본문은 원본 열람 시에만 표시됩니다.
              </p>

              {resume.essays.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  등록된 문항이 없습니다.
                </p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {resume.essays.map((essay, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                          {essay.title}
                        </p>
                        <span className="tabular shrink-0 text-xs text-slate-500">
                          {essay.type ? `${ESSAY_TYPE_LABELS[essay.type]} · ` : ''}
                          {essay.contentLength.toLocaleString()}자
                          {essay.charLimit
                            ? ` / ${essay.charLimit.toLocaleString()}`
                            : ''}
                        </span>
                      </div>

                      {essay.content ? (
                        <p className="mt-3 whitespace-pre-wrap border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-700">
                          {essay.content}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <section className="card">
            <p className="text-sm text-slate-500">
              작성된 이력서가 없습니다.
            </p>
          </section>
        )}

        <section className="card border-rose-200/80">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            계정 관리
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isSelf
              ? '자신의 계정은 백오피스에서 변경할 수 없습니다.'
              : '변경 내역은 모두 감사 로그에 남습니다.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSelf || pendingAction}
              onClick={() => void handleUpdate({ isActive: !user.isActive })}
              className="btn-ghost"
            >
              {user.isActive ? (
                <>
                  <UserX className="h-4 w-4" aria-hidden="true" />
                  계정 비활성화
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  계정 활성화
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isSelf || pendingAction}
              onClick={() =>
                void handleUpdate({
                  role: user.role === 'ADMIN' ? 'USER' : 'ADMIN',
                })
              }
              className="btn-ghost"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {user.role === 'ADMIN' ? '관리자 권한 회수' : '관리자로 승격'}
            </button>

            <button
              type="button"
              disabled={isSelf || pendingAction}
              onClick={() => setConfirm('delete')}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors enabled:hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              계정 삭제
            </button>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={confirm === 'reveal'}
        tone="neutral"
        title="개인정보 원본을 열람할까요?"
        description="이름 · 연락처 · 생년월일 · 주소와 자기소개서 본문이 표시됩니다. 열람 사실과 사유가 감사 로그에 남습니다."
        confirmLabel="열람"
        requireReason={{
          label: '열람 사유',
          options: Object.entries(REVEAL_REASON_LABELS).map(
            ([value, label]) => ({ value, label }),
          ),
        }}
        pending={revealing}
        onConfirm={(reason) => void handleReveal(reason)}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'delete'}
        title="이 계정을 삭제할까요?"
        description={`${user.email} · 가입 ${formatDate(
          user.createdAt,
        )} · ID ${shortId(user.id)} 의 계정과 프로필, 이력서가 모두 삭제됩니다. 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        requirePhrase={shortId(user.id)}
        pending={pendingAction}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function Detail({
  label,
  value,
  wide,
  mono,
}: {
  label: string;
  value: string | null;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-sm ${
          value ? 'text-slate-900' : 'text-slate-400'
        } ${mono ? 'tabular' : ''}`}
      >
        {value || '입력 없음'}
      </dd>
    </div>
  );
}

function Group({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const items = children.filter(Boolean);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">{items}</ul>
      )}
    </div>
  );
}

function Row({
  title,
  meta,
}: {
  title: string;
  meta: (string | null | undefined)[];
}) {
  const parts = meta.filter(Boolean) as string[];

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-sm font-medium text-slate-900">{title}</span>
      {parts.length > 0 ? (
        <span className="text-xs text-slate-500">{parts.join(' · ')}</span>
      ) : null}
    </li>
  );
}
