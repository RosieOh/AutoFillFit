'use client';

import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, clearToken, toErrorMessage } from '@/lib/axios';
import { clearMeCache, useMe } from '@/lib/use-me';
import { ArrowLeft, Download, Loader2, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { me, state } = useMe();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 내 데이터를 파일로 내려받는다.
   *
   * 탈퇴하면 되돌릴 수 없으므로 아래 탈퇴 영역보다 위에 둔다.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/api/users/me/export');

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `autofill-fit-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ variant: 'success', title: '내 데이터를 내려받았습니다' });
    } catch (err) {
      toast({
        variant: 'error',
        title: '내려받지 못했습니다',
        description: toErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await api.delete('/api/users/me', { data: { password } });

      // 이 기기의 확장에 남은 개인정보도 함께 지운다.
      window.postMessage(
        { source: 'autofill-fit-web', type: 'CLEAR' },
        window.location.origin,
      );

      clearMeCache();
      clearToken();
      router.replace('/login');
    } catch (err) {
      setError(toErrorMessage(err, '탈퇴하지 못했습니다.'));
      setDeleting(false);
    }
  };

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Zap className="h-4.5 w-4.5 text-white" aria-hidden="true" />
            </span>
            AutoFill-Fit
          </span>

          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            대시보드
          </Link>
        </div>

        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">
          계정
        </h1>
        <p className="mb-6 text-sm text-slate-500">{me?.email}</p>

        <div className="flex flex-col gap-4">
          {/* --- 내려받기 --- */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              내 데이터 내려받기
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              계정 정보와 인적사항, 학력·경력·자격증, 자기소개서 전문을 JSON
              파일 하나로 내려받습니다.
            </p>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="btn-ghost mt-4"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  준비 중
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  내려받기
                </>
              )}
            </button>
          </section>

          {/* --- 탈퇴 --- */}
          <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              회원 탈퇴
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              계정과 인적사항, 이력서가 모두 삭제됩니다.{' '}
              <strong className="font-medium text-slate-900">
                복구할 수 없습니다.
              </strong>{' '}
              탈퇴 전에 위에서 데이터를 먼저 내려받으시기를 권합니다.
            </p>

            {confirming ? (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
                <Field
                  label="비밀번호 확인"
                  hint="본인 확인을 위해 비밀번호를 다시 입력해 주세요."
                  error={error ?? undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete="current-password"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                    />
                  )}
                </Field>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting || password.length === 0}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        삭제 중
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        영구 삭제
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(false);
                      setPassword('');
                      setError(null);
                    }}
                    disabled={deleting}
                    className="btn-ghost"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                탈퇴하기
              </button>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
