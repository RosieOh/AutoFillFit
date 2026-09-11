import { LoadingScreen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Redirect, Tabs } from 'expo-router';
import { FileText, Settings, ShieldCheck } from 'lucide-react-native';

export default function TabsLayout() {
  const { state, isAdmin } = useAuth();

  if (state === 'loading') return <LoadingScreen />;
  if (state === 'anonymous') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#f8fafc' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', fontSize: 17, color: '#0f172a' },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
        sceneStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '내 이력서',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: '백오피스',
          // 관리자가 아니면 탭 자체를 숨긴다.
          href: isAdmin ? '/(tabs)/admin' : null,
          tabBarIcon: ({ color, size }) => (
            <ShieldCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
