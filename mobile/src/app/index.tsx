import { LoadingScreen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Redirect } from 'expo-router';

/** 저장된 토큰 확인이 끝날 때까지 기다렸다가 보낼 곳을 정한다. */
export default function Index() {
  const { state } = useAuth();

  if (state === 'loading') {
    return <LoadingScreen label="로그인 상태 확인 중" />;
  }

  return <Redirect href={state === 'authenticated' ? '/(tabs)' : '/login'} />;
}
