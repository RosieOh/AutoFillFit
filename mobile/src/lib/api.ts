import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'autofill-fit.token';

/**
 * 기기에서 보는 localhost는 PC가 아니다.
 * - Android 에뮬레이터: 호스트 PC = 10.0.2.2
 * - iOS 시뮬레이터: localhost 그대로
 * - 실기기: PC의 LAN IP를 EXPO_PUBLIC_API_BASE_URL로 지정해야 한다.
 */
function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) {
    if (Platform.OS === 'android') {
      return configured.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
    return configured;
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * SecureStore는 웹에서 동작하지 않으므로(Expo Web) 그때만 localStorage로 내려간다.
 * 네이티브에서는 항상 OS 키체인에 저장된다.
 */
const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return globalThis.localStorage?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* 저장 실패해도 현재 세션은 계속 동작한다. */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* noop */
    }
  },
};

/**
 * 인터셉터는 매 요청 저장소를 읽지 않고 메모리 캐시를 쓴다.
 * SecureStore 접근은 비동기 + 네이티브 브리지라 요청마다 태우면 체감이 느려진다.
 */
let tokenCache: string | null = null;

/**
 * 저장소 읽기는 비동기다. 이걸 기다리지 않으면 앱 첫 로드/딥링크에서
 * 토큰이 붙기 전에 요청이 나가 401 → 인터셉터가 토큰 삭제 → 로그인 상태였던
 * 사용자가 로그아웃당한다. 그래서 모든 요청이 하이드레이션을 기다린다.
 */
let hydration: Promise<string | null> | null = null;

export function ensureHydrated(): Promise<string | null> {
  if (!hydration) {
    hydration = storage.get(TOKEN_KEY).then((token) => {
      tokenCache = token;
      return token;
    });
  }
  return hydration;
}

export async function loadToken(): Promise<string | null> {
  return ensureHydrated();
}

export async function setToken(token: string): Promise<void> {
  tokenCache = token;
  hydration = Promise.resolve(token);
  await storage.set(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  tokenCache = null;
  hydration = Promise.resolve(null);
  await storage.remove(TOKEN_KEY);
}

export function getCachedToken(): string | null {
  return tokenCache;
}

/**
 * 401을 받았을 때 할 일은 화면 계층이 정한다.
 * 라이브러리 모듈에서 라우터를 직접 부르면 순환 의존이 생긴다.
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // 저장소 읽기가 끝난 뒤에 헤더를 붙인다(첫 로드 경쟁 조건 방지).
  const token = await ensureHydrated();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const isAuthRequest = error.config?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && !isAuthRequest) {
      await clearToken();
      onUnauthorized?.();
    }

    return Promise.reject(error);
  },
);

/** 서버 ValidationPipe의 message(문자열 배열)를 한 줄로 정리한다. */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return '요청 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.';
    }
    if (!error.response) {
      return `서버(${API_BASE_URL})에 연결할 수 없습니다. 주소와 네트워크를 확인해 주세요.`;
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
