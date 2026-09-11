'use client';

import { CompletenessBar } from '@/components/dashboard/completeness-bar';
import { ExtensionCard } from '@/components/dashboard/extension-card';
import { CertificateSection } from '@/components/dashboard/sections/certificate-section';
import { EssaySection } from '@/components/dashboard/sections/essay-section';
import { HistorySection } from '@/components/dashboard/sections/history-section';
import { ProfileSection } from '@/components/dashboard/sections/profile-section';
import {
  MobileSectionTabs,
  NAV_ITEMS,
  Sidebar,
} from '@/components/dashboard/sidebar';
import { useToast } from '@/components/ui/toast';
import { api, clearToken, getToken, toErrorMessage } from '@/lib/axios';
import { useExtension } from '@/lib/extension-bridge';
import { clearMeCache, useMe } from '@/lib/use-me';
import {
  calculateCompleteness,
  type SectionKey,
} from '@/lib/completeness';
import {
  EMPTY_FORM,
  toFormValues,
  toUpsertPayload,
  type ResumeFormValues,
} from '@/lib/resume-form';
import type { MyResumeResponse } from '@/types/resume';
import {
  AlertCircle,
  Check,
  Loader2,
  LogOut,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

type LoadState = 'loading' | 'ready' | 'error';

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin } = useMe();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /**
   * 서버는 가입 시 만들어진 프로필의 updatedAt도 내려주므로 savedAt만으로는
   * "저장한 적 있음"을 판정할 수 없다. 이력서 레코드 존재 여부로 판단한다.
   */
  const [hasSavedResume, setHasSavedResume] = useState(false);
  const [active, setActive] = useState<SectionKey>('profile');
  const [autofill, setAutofill] = useState<MyResumeResponse['autofill'] | null>(
    null,
  );
  /** 마지막 저장 이후 확장에 전달했는가 (시계 비교 대신 로컬 사실로 판정) */
  const [syncedAfterSave, setSyncedAfterSave] = useState(false);

  // 확장 프로그램 연결 상태 — 이 제품의 실체가 화면에 드러나야 한다.
  const {
    state: extensionState,
    info: extensionInfo,
    sync: syncExtension,
    syncing,
    syncError,
    clear: clearExtension,
  } = useExtension(autofill);

  const methods = useForm<ResumeFormValues>({
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = methods;

  // 완성도는 저장 전 입력까지 즉시 반영해야 의미가 있다.
  const values = useWatch({ control }) as ResumeFormValues;
  const completeness = calculateCompleteness({ ...EMPTY_FORM, ...values });

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);

    try {
      const { data } = await api.get<MyResumeResponse>('/api/resume/my');
      setEmail(data.user.email);
      setSavedAt(data.resume ? data.updatedAt : null);
      setHasSavedResume(Boolean(data.resume));
      setAutofill(data.autofill);
      // 확장이 이미 이 내용을 갖고 있는지는 알 수 없으므로 전달 필요로 본다.
      setSyncedAfterSave(false);
      reset(toFormValues(data));
      setLoadState('ready');
    } catch (error) {
      setLoadError(
        toErrorMessage(error, '이력서를 불러오지 못했습니다.'),
      );
      setLoadState('error');
    }
  }, [reset]);

  useEffect(() => {
    // 토큰이 없으면 API를 호출하지 않고 바로 로그인으로 보낸다.
    if (!getToken()) {
      router.replace('/login?next=%2Fdashboard');
      return;
    }
    void load();
  }, [load, router]);

  const onSubmit = handleSubmit(async (formValues) => {
    try {
      const { data } = await api.patch<MyResumeResponse>(
        '/api/resume/my',
        toUpsertPayload(formValues),
      );

      setSavedAt(data.resume ? data.updatedAt : null);
      setHasSavedResume(Boolean(data.resume));
      setAutofill(data.autofill);
      setSyncedAfterSave(false); // 저장했으니 다시 전달해야 한다
      // 서버가 정규화한 값(전화번호 등)을 폼에 되돌려 dirty 상태를 초기화한다.
      reset(toFormValues(data));

      toast({
        variant: 'success',
        title: '이력서를 저장했습니다',
        description: '확장 프로그램이 다음 지원서부터 새 정보를 사용합니다.',
      });
    } catch (error) {
      toast({
        variant: 'error',
        title: '저장하지 못했습니다',
        description: toErrorMessage(error, '잠시 후 다시 시도해 주세요.'),
      });
    }
  });

  /**
   * 자소서 1,000자를 쓰다가 탭을 닫으면 전부 사라진다.
   * 브라우저가 허용하는 유일한 방어선이 beforeunload다.
   */
  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 최신 브라우저는 메시지를 무시하고 기본 문구를 쓴다.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // 긴 폼에서는 저장 단축키가 실제로 쓰인다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        // 버튼과 같은 가드를 적용한다. 없으면 로딩 중(EMPTY_FORM) Ctrl+S가
        // 서버의 이력서를 빈 값으로 덮어쓴다.
        if (loadState !== 'ready' || !isDirty || isSubmitting) return;
        void onSubmit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSubmit, loadState, isDirty, isSubmitting]);

  const handleSignOut = () => {
    if (
      isDirty &&
      !window.confirm(
        '저장하지 않은 변경사항이 있습니다. 로그아웃하면 사라집니다. 계속할까요?',
      )
    ) {
      return;
    }

    // 이 기기의 확장에 남은 개인정보를 지운다.
    // 지우지 않으면 같은 브라우저의 다음 사용자가 이전 사용자 이력서로 채운다.
    clearExtension();
    clearToken();
    clearMeCache();
    router.replace('/login');
  };

  const activeItem = NAV_ITEMS.find((item) => item.key === active);

  /**
   * "저장했는데 아직 전달하지 않음"을 판정한다.
   * savedAt(서버 시계)과 syncedAt(브라우저 시계)을 직접 비교하면 시계 오차로
   * 경고가 영구히 남거나 영영 안 뜬다. 이 세션에서 저장이 전달보다 나중이었는지를
   * 로컬 카운터로 판정한다.
   */
  const stale = hasSavedResume && !syncedAfterSave;

  const extensionCard = (
    <ExtensionCard
      state={extensionState}
      info={extensionInfo}
      onSync={syncExtension}
      syncing={syncing}
      syncError={syncError}
      ready={completeness.total >= 100}
      stale={stale}
      onSynced={() => setSyncedAfterSave(true)}
    />
  );

  // 아직 아무것도 없거나 다 채운 순간에는 확장이 다음 행동이다.
  const extensionPriority =
    completeness.total === 0 || completeness.total >= 100;

  return (
    <FormProvider {...methods}>
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          isAdmin={isAdmin}
          loading={loadState !== 'ready'}
          isDirty={isDirty}
          active={active}
          onSelect={setActive}
          completeness={completeness}
          email={email}
          onSignOut={handleSignOut}
        />

        <div className="lg:pl-64">
          <form onSubmit={onSubmit}>
            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/85 backdrop-blur">
              <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                    {activeItem?.label ?? '내 이력서'}
                  </h1>
                  {/* 로딩 중에 상태를 단언하면 거짓말이 된다. */}
                  {loadState !== 'ready' ? (
                    <span className="mt-1.5 block h-3 w-32 animate-pulse rounded bg-slate-200" />
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {isDirty ? (
                        <span className="text-amber-700">
                          저장되지 않은 변경사항이 있습니다
                        </span>
                      ) : savedAt ? (
                        <>마지막 저장 {formatSavedAt(savedAt)}</>
                      ) : (
                        '아직 저장한 이력서가 없습니다'
                      )}
                    </p>
                  )}
                </div>

                {/*
                  저장한 적도 없고 바뀐 것도 없으면 버튼을 아예 그리지 않는다.
                  (hidden 속성은 .btn-primary의 inline-flex에 덮여 듣지 않는다.)
                */}
                <div className="flex items-center gap-2">
                {/* 사이드바가 숨는 좁은 화면에서도 로그아웃 경로가 있어야 한다. */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="로그아웃"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>

                {loadState === 'ready' && !isDirty && !hasSavedResume ? null : (
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty || loadState !== 'ready'}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      저장 중
                    </>
                  ) : isDirty ? (
                    <>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      저장하기
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      저장됨
                    </>
                  )}
                </button>
                )}
                </div>
              </div>

              {/* 좁은 화면에서는 섹션 전환을 헤더 안에 둔다. */}
              {loadState === 'ready' ? (
                <div className="mx-auto max-w-4xl px-6 pb-3">
                  <MobileSectionTabs
                    active={active}
                    onSelect={setActive}
                    completeness={completeness}
                    loading={loadState !== 'ready'}
                  />
                </div>
              ) : null}
            </header>

            <main className="mx-auto max-w-4xl space-y-6 px-6 py-6">
              {loadState === 'loading' ? (
                <LoadingSkeleton />
              ) : loadState === 'error' ? (
                <ErrorPanel message={loadError} onRetry={() => void load()} />
              ) : (
                <>
                  {/*
                    첫인상이 "0%"가 아니라 "이게 뭘 해주는지"가 되도록,
                    빈 상태와 완성 상태에서는 확장 카드를 완성도 위에 둔다.
                    DOM 위치를 바꾸면 카드가 재마운트되어 펼쳐 둔 안내가 닫히므로,
                    같은 자리에 두고 CSS order로만 순서를 바꾼다.
                  */}
                  <div className="flex flex-col gap-6">
                    <div style={{ order: extensionPriority ? 0 : 1 }}>
                      {extensionCard}
                    </div>
                    <div style={{ order: extensionPriority ? 1 : 0 }}>
                      <CompletenessBar
                        completeness={completeness}
                        onJump={setActive}
                      />
                    </div>
                  </div>

                  {active === 'profile' ? <ProfileSection /> : null}
                  {active === 'history' ? <HistorySection /> : null}
                  {active === 'certificates' ? <CertificateSection /> : null}
                  {active === 'essays' ? <EssaySection /> : null}
                </>
              )}
            </main>
          </form>
        </div>
      </div>
    </FormProvider>
  );
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '방금';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">이력서를 불러오는 중입니다.</span>
      <div className="card">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-9 w-28 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="card">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <div className="h-3.5 w-16 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string | null;
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
            이력서를 불러오지 못했습니다
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {message ?? '알 수 없는 오류가 발생했습니다.'}
          </p>
          <button type="button" onClick={onRetry} className="btn-ghost mt-4">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
