'use client';

import { Field, Input } from '@/components/ui/field';
import { api, toErrorMessage } from '@/lib/axios';
import { ArrowLeft, Loader2, Mail, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

interface FormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFailed(null);
    try {
      await api.post('/auth/forgot-password', { email: values.email });
      setSent(true);
    } catch (error) {
      setFailed(toErrorMessage(error, '잠시 후 다시 시도해 주세요.'));
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
          {sent ? (
            <>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                메일을 확인해 주세요
              </h1>
              {/*
                가입 여부를 알려주지 않는다. "가입되지 않은 이메일입니다"를
                돌려주면 이 화면이 곧 회원 목록 조회기가 된다.
              */}
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                <strong className="font-medium text-slate-900">
                  {getValues('email')}
                </strong>
                로 가입된 계정이 있다면 재설정 링크를 보냈습니다. 링크는 1시간
                동안, 한 번만 사용할 수 있습니다.
              </p>
              <p className="mt-3 text-sm text-slate-500">
                메일이 오지 않으면 스팸함을 확인하시고, 주소를 다시 확인해
                주세요.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                비밀번호 재설정
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                가입한 이메일로 재설정 링크를 보내드립니다.
              </p>

              <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
                <Field label="이메일" required error={errors.email?.message}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="email"
                      autoComplete="email"
                      autoFocus
                      aria-describedby={describedBy}
                      invalid={invalid}
                      placeholder="you@example.com"
                      {...register('email', {
                        required: '이메일을 입력해 주세요.',
                      })}
                    />
                  )}
                </Field>

                {failed ? (
                  <p className="text-sm text-red-600" role="alert">
                    {failed}
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
                      보내는 중
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      재설정 링크 받기
                    </>
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
