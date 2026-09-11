'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MeResponse } from '@/types/admin';
import { api, getToken } from './axios';

type MeState = 'loading' | 'ready' | 'anonymous';

/** 여러 화면이 같은 정보를 필요로 하므로 세션당 한 번만 요청한다. */
let cached: MeResponse | null = null;
let inflight: Promise<MeResponse> | null = null;

async function fetchMe(): Promise<MeResponse> {
  if (cached) return cached;
  if (!inflight) {
    inflight = api
      .get<MeResponse>('/auth/me')
      .then(({ data }) => {
        cached = data;
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** 로그아웃 시 캐시를 비운다. */
export function clearMeCache(): void {
  cached = null;
}

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(cached);
  const [state, setState] = useState<MeState>(cached ? 'ready' : 'loading');

  const load = useCallback(async () => {
    if (!getToken()) {
      setState('anonymous');
      return;
    }

    try {
      const data = await fetchMe();
      setMe(data);
      setState('ready');
    } catch {
      // 401이면 axios 인터셉터가 이미 로그인으로 보낸다.
      setState('anonymous');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { me, state, isAdmin: me?.role === 'ADMIN' };
}
