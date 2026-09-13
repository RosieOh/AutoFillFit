'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MyResumeResponse } from '@/types/resume';

/**
 * content script는 document_idle에 주입되고 이 컴포넌트는 hydration 후 마운트된다.
 * 어느 쪽이 먼저일지 보장되지 않으므로 한 번만 보내면 놓칠 수 있다. 재시도한다.
 */
const PING_INTERVAL_MS = 250;
const PING_TIMEOUT_MS = 2500;

/** 연결 후에도 주기적으로 확인한다 — 이력 갱신과 확장 종료 감지를 겸한다. */
const REFRESH_INTERVAL_MS = 10_000;

/** SYNC 응답이 이 시간 안에 오지 않으면 실패로 본다. */
const SYNC_TIMEOUT_MS = 3000;

export interface FillEvent {
  host: string;
  filled: number;
  at: string;
}

export interface ExtensionInfo {
  version: string;
  /** 대시보드가 마지막으로 이력서를 넘겨준 시각 */
  syncedAt: string | null;
  history: FillEvent[];
}

type BridgeState = 'checking' | 'connected' | 'absent';

interface ExtensionMessage {
  source?: string;
  type?: string;
  version?: string;
  syncedAt?: string | null;
  history?: FillEvent[];
  message?: string;
}

/**
 * 확장 프로그램과의 핸드셰이크.
 *
 * externally_connectable을 쓰면 확장 ID를 알아야 하는데, 개발 중 unpacked 확장은
 * ID가 매번 달라진다. content script가 이 페이지에도 주입되므로 postMessage로 주고받는다.
 */
export function useExtension(
  autofill: MyResumeResponse['autofill'] | null,
  /**
   * 서버가 기록한 이력서 마지막 저장 시각.
   *
   * 확장은 "언제 전달받았는지"는 알지만 "그 이력서가 언제 작성된 것인지"는
   * 모른다. 두 달 전 이력서를 그대로 채우면서도 어제 전달했으면 최신처럼 보인다.
   */
  resumeUpdatedAt?: string | null,
) {
  const [state, setState] = useState<BridgeState>('checking');
  const [info, setInfo] = useState<ExtensionInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handshakeTimeout = useRef<number | null>(null);
  const handshakePoller = useRef<number | null>(null);
  const refresher = useRef<number | null>(null);
  const syncTimeout = useRef<number | null>(null);

  /** sync 요청과 응답을 짝짓는다. 지연 응답이 나중 요청의 결과를 덮어쓰지 않게. */
  const syncNonce = useRef(0);

  /** deps에 넣지 않고도 최신 값을 쓰기 위한 참조 (effect는 한 번만 돈다). */
  const autofillRef = useRef(autofill);
  autofillRef.current = autofill;

  const updatedAtRef = useRef(resumeUpdatedAt);
  updatedAtRef.current = resumeUpdatedAt;

  const clearSyncTimeout = useCallback(() => {
    if (syncTimeout.current) {
      window.clearTimeout(syncTimeout.current);
      syncTimeout.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ping = () =>
      window.postMessage(
        { source: 'autofill-fit-web', type: 'PING' },
        window.location.origin,
      );

    const onMessage = (event: MessageEvent<ExtensionMessage>) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== 'autofill-fit-extension') return;

      if (event.data.type === 'PONG') {
        if (handshakeTimeout.current) {
          window.clearTimeout(handshakeTimeout.current);
          handshakeTimeout.current = null;
        }
        if (handshakePoller.current) {
          window.clearInterval(handshakePoller.current);
          handshakePoller.current = null;
        }

        setState('connected');
        setInfo({
          version: event.data.version ?? '알 수 없음',
          syncedAt: event.data.syncedAt ?? null,
          history: event.data.history ?? [],
        });
      }

      if (event.data.type === 'SYNCED') {
        clearSyncTimeout();
        setSyncing(false);
        setSyncError(null);
        setInfo((current) =>
          current ? { ...current, syncedAt: event.data.syncedAt ?? null } : current,
        );
      }

      if (event.data.type === 'SYNC_FAILED') {
        clearSyncTimeout();
        setSyncing(false);
        setSyncError(event.data.message ?? '확장에 저장하지 못했습니다.');
      }

      if (event.data.type === 'CLEARED') {
        setInfo((current) =>
          current ? { ...current, syncedAt: null, history: [] } : current,
        );
      }
    };

    window.addEventListener('message', onMessage);
    ping();
    handshakePoller.current = window.setInterval(ping, PING_INTERVAL_MS);

    // 끝까지 응답이 없으면 확장이 없는 것으로 본다.
    handshakeTimeout.current = window.setTimeout(() => {
      if (handshakePoller.current) {
        window.clearInterval(handshakePoller.current);
        handshakePoller.current = null;
      }
      setState((current) => (current === 'checking' ? 'absent' : current));
    }, PING_TIMEOUT_MS);

    // 연결된 뒤에도 주기적으로 다시 물어야 자동 채움 이력이 갱신된다.
    refresher.current = window.setInterval(ping, REFRESH_INTERVAL_MS);

    return () => {
      window.removeEventListener('message', onMessage);
      if (handshakeTimeout.current) window.clearTimeout(handshakeTimeout.current);
      if (handshakePoller.current) window.clearInterval(handshakePoller.current);
      if (refresher.current) window.clearInterval(refresher.current);
      clearSyncTimeout();
    };
  }, [clearSyncTimeout]);

  /** 확장에 최신 이력서를 넘긴다. 토큰은 넘기지 않는다. */
  const sync = useCallback(() => {
    const current = autofillRef.current;
    if (!current || state !== 'connected') return;

    const nonce = ++syncNonce.current;
    setSyncing(true);
    setSyncError(null);

    window.postMessage(
      {
        source: 'autofill-fit-web',
        type: 'SYNC',
        nonce,
        /**
         * 인적사항.
         *
         * birthdate·address·zipCode는 서버가 내려주는데도 오랫동안 여기서 빠져
         * 대시보드에 입력한 주소와 생년월일이 확장까지 도달하지 못했다.
         */
        profile: {
          name: current.name ?? '',
          email: current.email,
          phone: current.phone ?? '',
          birthdate: current.birthdate ?? '',
          address: current.address ?? '',
          zipCode: current.zipCode ?? '',
          // 문항을 찾지 못했을 때만 쓰는 fallback
          coverLetter: current.coverLetter ?? '',
        },
        /**
         * 자소서 문항 전체.
         * 이걸 넘기지 않으면 확장이 모든 장문 칸에 같은 글을 넣는다.
         */
        essays: current.essays ?? [],
        /**
         * 학력·경력·자격증.
         * 대시보드가 70점을 배정하는 내용인데 전달되지 않으면
         * 지원서에 한 글자도 들어가지 않는다.
         */
        education: current.education ?? [],
        careers: current.careers ?? [],
        certificates: current.certificates ?? [],
        /** 확장이 "이 이력서는 언제 쓴 것인가"를 보여줄 수 있도록 함께 넘긴다 */
        resumeUpdatedAt: updatedAtRef.current ?? null,
      },
      window.location.origin,
    );

    /**
     * 확장이 리로드되면 리스너는 남지만 chrome.*가 무효라 응답이 오지 않는다.
     * 타임아웃이 없으면 '전달 중' 버튼이 새로고침 전까지 영구 비활성이 된다.
     */
    clearSyncTimeout();
    syncTimeout.current = window.setTimeout(() => {
      if (syncNonce.current !== nonce) return;
      setSyncing(false);
      setSyncError('확장이 응답하지 않습니다. 페이지를 새로고침해 주세요.');
    }, SYNC_TIMEOUT_MS);
  }, [state, clearSyncTimeout]);

  /** 로그아웃 시 이 기기의 확장에 남은 개인정보를 지운다. */
  const clear = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.postMessage(
      { source: 'autofill-fit-web', type: 'CLEAR' },
      window.location.origin,
    );
  }, []);

  return { state, info, sync, syncing, syncError, clear };
}
