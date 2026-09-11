import { LoadingScreen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

/**
 * (tabs) 밖의 스택 화면에도 같은 게이트가 필요하다.
 * 딥링크나 새로고침으로 바로 진입할 수 있기 때문이다.
 * 토큰 복원이 끝나기 전에는 판단을 미룬다 — 여기서 성급하게 로그인으로
 * 보내면 로그인 상태인 사용자가 쫓겨난다.
 */
export function AuthGate({
  children,
  requireAdmin,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { state, isAdmin } = useAuth();

  if (state === 'loading') return <LoadingScreen />;
  if (state === 'anonymous') return <Redirect href="/login" />;

  if (requireAdmin && !isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-base font-semibold text-slate-900">
          백오피스 접근 권한이 없습니다
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          관리자 권한은 서버에서 부여해야 합니다.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}
