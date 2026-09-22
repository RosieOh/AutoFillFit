'use client';

import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, setToken, toErrorMessage } from '@/lib/axios';
import type { AuthResponse } from '@/types/resume';
import { Loader2, LogIn, Zap } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { forwardRef, Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

interface LoginFormValues {
  email: string;
  password: string;
  /** 가입 시에만 쓰는 필수 동의 (개인정보보호법 제15조) */
  termsAgreed: boolean;
  privacyAgreed: boolean;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
      termsAgreed: false,
      privacyAgreed: false,
    },
  });

  const next = searchParams.get('next') ?? '/dashboard';

  const onSubmit = handleSubmit(async (values) => {
    try {
      /*
       * 로그인에 동의 필드를 함께 보내면 서버의 whitelist 검증이 400을 낸다.
       * 모드에 따라 본문을 따로 만든다.
       */
      const body =
        mode === 'login'
          ? { email: values.email, password: values.password }
          : values;

      const { data } = await api.post<AuthResponse>(
        mode === 'login' ? '/auth/login' : '/auth/signup',
        body,
      );

      setToken(data.accessToken);
      router.replace(next);
    } catch (error) {
      toast({
        variant: 'error',
        title:
          mode === 'login'
            ? '로그인하지 못했습니다'
            : '가입하지 못했습니다',
        description: toErrorMessage(error, '잠시 후 다시 시도해 주세요.'),
      });
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

        <div className="card">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {mode === 'login' ? '다시 오셨네요' : '계정 만들기'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login'
              ? '저장해 둔 이력서를 불러옵니다.'
              : '이력서를 저장할 계정을 만듭니다.'}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="이메일" required error={errors.email?.message}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  placeholder="hong@example.com"
                  {...register('email', {
                    required: '이메일을 입력해 주세요.',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: '올바른 이메일 형식이 아닙니다.',
                    },
                  })}
                />
              )}
            </Field>

            <Field
              label="비밀번호"
              required
              hint={
                mode === 'signup' ? '영문과 숫자를 포함해 8자 이상' : undefined
              }
              error={errors.password?.message}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  aria-describedby={describedBy}
                  invalid={invalid}
                  placeholder="••••••••"
                  {...register('password', {
                    required: '비밀번호를 입력해 주세요.',
                    minLength: {
                      value: 8,
                      message: '8자 이상 입력해 주세요.',
                    },
                  })}
                />
              )}
            </Field>

            {mode === 'signup' && (
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
                <Consent
                  id="terms"
                  error={errors.termsAgreed?.message}
                  {...register('termsAgreed', {
                    required: '이용약관에 동의해야 가입할 수 있습니다.',
                  })}
                >
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 underline underline-offset-2"
                  >
                    이용약관
                  </a>
                  에 동의합니다 <span className="text-slate-500">(필수)</span>
                </Consent>

                <Consent
                  id="privacy"
                  error={errors.privacyAgreed?.message}
                  {...register('privacyAgreed', {
                    required: '개인정보 수집·이용에 동의해야 가입할 수 있습니다.',
                  })}
                >
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 underline underline-offset-2"
                  >
                    개인정보 수집·이용
                  </a>
                  에 동의합니다 <span className="text-slate-500">(필수)</span>
                </Consent>

                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  이름·연락처·생년월일·주소와 자기소개서 내용을 보관합니다.
                  탈퇴하면 모두 삭제됩니다.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {mode === 'login' ? '로그인 중' : '가입 중'}
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  {mode === 'login' ? '로그인' : '가입하고 시작하기'}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>
              <a
                href="/forgot-password"
                className="font-medium text-slate-600 underline underline-offset-2 transition-colors hover:text-slate-900"
              >
                비밀번호를 잊으셨나요?
              </a>
              <br />
            </>
          ) : null}
          {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="inline-flex min-h-11 items-center rounded px-2 font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            {mode === 'login' ? '가입하기' : '로그인하기'}
          </button>
        </p>
      </div>
    </main>
  );
}

/**
 * 동의 체크박스 한 줄.
 *
 * 무엇에 동의하는지 링크로 열어볼 수 있어야 한다.
 * 체크박스만 있고 읽을 문서가 없으면 동의를 받았다고 보기 어렵다.
 */
const Consent = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    error?: string;
    children: React.ReactNode;
  }
>(function Consent({ id, error, children, ...props }, ref) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-700"
      >
        <input
          id={id}
          ref={ref}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/60"
          {...props}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="pl-6.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
