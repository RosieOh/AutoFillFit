'use client';

import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, setToken, toErrorMessage } from '@/lib/axios';
import type { AuthResponse } from '@/types/resume';
import { Loader2, LogIn, Zap } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

interface LoginFormValues {
  email: string;
  password: string;
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
    defaultValues: { email: '', password: '' },
  });

  const next = searchParams.get('next') ?? '/dashboard';

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { data } = await api.post<AuthResponse>(
        mode === 'login' ? '/auth/login' : '/auth/signup',
        values,
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
