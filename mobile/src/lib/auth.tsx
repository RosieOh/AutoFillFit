import type { MeResponse } from '@/types/admin';
import type { AuthResponse } from '@/types/resume';
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  clearToken,
  loadToken,
  setToken,
  setUnauthorizedHandler,
} from './api';

type AuthState = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  state: AuthState;
  me: MeResponse | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);

  /** 저장된 토큰이 아직 유효한지 확인한다. 탈퇴·비활성·만료를 여기서 걸러낸다. */
  const restore = useCallback(async () => {
    const token = await loadToken();
    if (!token) {
      setState('anonymous');
      return;
    }

    try {
      const { data } = await api.get<MeResponse>('/auth/me');
      setMe(data);
      setState('authenticated');
    } catch {
      await clearToken();
      setMe(null);
      setState('anonymous');
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  // 토큰이 만료되면 어느 화면에 있든 로그인으로 되돌린다.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null);
      setState('anonymous');
      router.replace('/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const authenticate = useCallback(
    async (path: '/auth/login' | '/auth/signup', email: string, password: string) => {
      const { data } = await api.post<AuthResponse>(path, { email, password });
      await setToken(data.accessToken);
      setMe({ id: data.user.id, email: data.user.email, role: data.user.role });
      setState('authenticated');
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      me,
      isAdmin: me?.role === 'ADMIN',
      signIn: (email, password) => authenticate('/auth/login', email, password),
      signUp: (email, password) => authenticate('/auth/signup', email, password),
      signOut: async () => {
        await clearToken();
        setMe(null);
        setState('anonymous');
        router.replace('/login');
      },
    }),
    [state, me, authenticate, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.');
  }
  return context;
}
