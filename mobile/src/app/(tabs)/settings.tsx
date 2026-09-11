import { Button, Card } from '@/components/ui';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LogOut, ShieldCheck } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

export default function SettingsScreen() {
  const { me, isAdmin, signOut } = useAuth();

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-5 gap-4"
    >
      <Card>
        <Text className="text-sm font-medium text-slate-500">계정</Text>

        <View className="mt-3 flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Text className="text-xs font-semibold uppercase text-slate-600">
              {me?.email?.slice(0, 2) ?? '--'}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
              {me?.email ?? ''}
            </Text>
            {isAdmin ? (
              <View className="mt-1 flex-row items-center gap-1">
                <ShieldCheck size={12} color="#0f172a" />
                <Text className="text-xs text-slate-500">관리자</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      <Card>
        <Text className="text-sm font-medium text-slate-500">연결된 서버</Text>
        <Text className="mt-2 text-sm text-slate-900">{API_BASE_URL}</Text>
        <Text className="mt-2 text-xs leading-relaxed text-slate-500">
          실기기에서 테스트할 때는 PC의 LAN IP가 필요합니다.
          {'\n'}
          .env의 EXPO_PUBLIC_API_BASE_URL을 바꾼 뒤 앱을 다시 시작하세요.
        </Text>
      </Card>

      <Button
        label="로그아웃"
        variant="ghost"
        onPress={() => void signOut()}
        icon={<LogOut size={16} color="#475569" />}
      />
    </ScrollView>
  );
}
