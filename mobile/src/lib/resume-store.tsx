import type { MyResumeResponse } from '@/types/resume';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { api, toErrorMessage } from './api';
import { useAuth } from './auth';
import { calculateCompleteness, type Completeness } from './completeness';
import {
  EMPTY_FORM,
  toFormValues,
  toUpsertPayload,
  type ResumeFormValues,
} from './resume-form';

type LoadState = 'loading' | 'ready' | 'error';

interface ResumeContextValue {
  state: LoadState;
  error: string | null;
  savedAt: string | null;
  /**
   * 서버는 가입 시 생성된 프로필의 updatedAt도 내려주므로 savedAt만으로는
   * "저장한 적 있음"을 판정할 수 없다.
   */
  hasSavedResume: boolean;
  completeness: Completeness;
  reload: () => Promise<void>;
  /** 저장 성공 여부를 반환한다. 실패 메시지는 error에 담긴다. */
  save: () => Promise<{ ok: boolean; message?: string }>;
}

const ResumeContext = createContext<ResumeContextValue | null>(null);

/**
 * 홈 화면과 섹션 편집 화면이 같은 폼을 공유해야 한다.
 * 화면마다 따로 불러오면 편집 후 돌아왔을 때 완성도가 어긋난다.
 */
export function ResumeProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasSavedResume, setHasSavedResume] = useState(false);

  const methods = useForm<ResumeFormValues>({
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  });
  const { reset, getValues, control } = methods;

  const values = useWatch({ control }) as ResumeFormValues;
  const completeness = useMemo(
    () => calculateCompleteness({ ...EMPTY_FORM, ...values }),
    [values],
  );

  const reload = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const { data } = await api.get<MyResumeResponse>('/api/resume/my');
      setSavedAt(data.resume ? data.updatedAt : null);
      setHasSavedResume(Boolean(data.resume));
      reset(toFormValues(data));
      setState('ready');
    } catch (err) {
      setError(toErrorMessage(err, '이력서를 불러오지 못했습니다.'));
      setState('error');
    }
  }, [reset]);

  useEffect(() => {
    if (authState === 'authenticated') {
      void reload();
      return;
    }

    /**
     * 로그아웃하면 폼을 반드시 비운다.
     * 비우지 않으면 같은 기기에서 다른 계정으로 로그인했을 때
     * 이전 사용자의 이름·연락처·자소서가 그대로 보이고, 저장하면 그 계정에 쓰인다.
     */
    if (authState === 'anonymous') {
      reset(EMPTY_FORM);
      setSavedAt(null);
      setHasSavedResume(false);
      setState('loading');
    }
  }, [authState, reload, reset]);

  const save = useCallback(async () => {
    try {
      const { data } = await api.patch<MyResumeResponse>(
        '/api/resume/my',
        toUpsertPayload(getValues()),
      );

      setSavedAt(data.resume ? data.updatedAt : null);
      setHasSavedResume(Boolean(data.resume));
      // 서버가 정규화한 값(전화번호 등)을 되돌려 dirty 상태를 초기화한다.
      reset(toFormValues(data));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: toErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
      };
    }
  }, [getValues, reset]);

  const value = useMemo<ResumeContextValue>(
    () => ({ state, error, savedAt, hasSavedResume, completeness, reload, save }),
    [state, error, savedAt, hasSavedResume, completeness, reload, save],
  );

  return (
    <ResumeContext.Provider value={value}>
      <FormProvider {...methods}>{children}</FormProvider>
    </ResumeContext.Provider>
  );
}

export function useResume(): ResumeContextValue {
  const context = useContext(ResumeContext);
  if (!context) {
    throw new Error('useResume은 ResumeProvider 안에서만 쓸 수 있습니다.');
  }
  return context;
}
