'use client';

import { Field, Input } from '@/components/ui/field';
import { api, toErrorMessage } from '@/lib/axios';
import { ArrowLeft, Check, Loader2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

interface FormValues {
  password: string;
  confirm: string;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { password: '', confirm: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFailed(null);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: values.password,
      });
      setDone(true);
    } catch (error) {
      setFailed(
        toErrorMessage(error, '링크가 만료되었거나 이미 사용되었습니다.'),
      );
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Zap className="h-4.5 w-4.5 text-white" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">
            AutoFill-Fit
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          {/* 링크 없이 들어온 경우를 먼저 처리한다 — 폼을 보여줘도 할 수 있는 게 없다 */}
          {token === '' ? (
            <>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                링크가 올바르지 않습니다
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                메일에 있는 링크를 그대로 열어 주세요. 주소가 잘려 있으면
                동작하지 않습니다.
              </p>
              <Link href="/forgot-password" className="btn-ghost mt-4">
                링크 다시 받기
              </Link>
            </>
          ) : done ? (
            <>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-3.5 w-3.5 text-green-700" aria-hidden="true" />
                </span>
                비밀번호를 바꿨습니다
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                새 비밀번호로 로그인해 주세요.
              </p>
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="btn-primary mt-4 w-full"
              >
                로그인하기
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                새 비밀번호 설정
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                영문과 숫자를 포함해 8자 이상
              </p>

              <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
                <Field
                  label="새 비밀번호"
                  required
                  error={errors.password?.message}
                >
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete="new-password"
                      autoFocus
                      aria-describedby={describedBy}
                      invalid={invalid}
                      placeholder="••••••••"
                      {...register('password', {
                        required: '비밀번호를 입력해 주세요.',
                        minLength: { value: 8, message: '8자 이상 입력해 주세요.' },
                        pattern: {
                          value: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                          message: '영문과 숫자를 모두 포함해야 합니다.',
                        },
                      })}
                    />
                  )}
                </Field>

                <Field
                  label="새 비밀번호 확인"
                  required
                  error={errors.confirm?.message}
                >
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete="new-password"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      placeholder="••••••••"
                      {...register('confirm', {
                        required: '한 번 더 입력해 주세요.',
                        validate: (value) =>
                          value === watch('password') ||
                          '두 비밀번호가 다릅니다.',
                      })}
                    />
                  )}
                </Field>

                {failed ? (
                  <p className="text-sm text-red-600" role="alert">
                    {failed}{' '}
                    <Link
                      href="/forgot-password"
                      className="font-medium underline underline-offset-2"
                    >
                      링크 다시 받기
                    </Link>
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      바꾸는 중
                    </>
                  ) : (
                    '비밀번호 바꾸기'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-sm">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center gap-1.5 rounded px-2 font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
