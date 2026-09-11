import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const TOKEN_STORAGE_KEY = 'autofill-fit.token';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export function getToken(): string | null {
  // SSR 단계에서는 localStorage가 없다.
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // 사생활 보호 모드 등에서 접근이 차단될 수 있다.
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* 저장 실패 시에도 현재 세션은 계속 동작한다. */
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

/** 요청마다 localStorage의 JWT를 Authorization 헤더에 실어 보낸다. */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;

    // 토큰 만료/위조 시 저장된 토큰을 버리고 로그인으로 보낸다.
    // 로그인 요청 자체의 401은 화면에서 메시지로 처리해야 하므로 제외한다.
    const isAuthRequest = error.config?.url?.startsWith('/auth/');
    if (status === 401 && !isAuthRequest && typeof window !== 'undefined') {
      clearToken();
      const next = encodeURIComponent(window.location.pathname);
      window.location.replace(`/login?next=${next}`);
    }

    return Promise.reject(error);
  },
);

/**
 * 서버의 ValidationPipe는 message를 문자열 배열로 내려준다.
 * 사용자에게 보여줄 한 줄 메시지로 정리한다.
 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return '요청 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (!error.response) {
      return `API 서버(${API_BASE_URL})에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.`;
    }

    const message = (error.response.data as { message?: string | string[] })
      ?.message;
    if (Array.isArray(message) && message.length > 0) {
      return message.length === 1
        ? message[0]
        : `${message[0]} 외 ${message.length - 1}건`;
    }
    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}
