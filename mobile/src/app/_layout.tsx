import '@/global.css';

import { ToastProvider } from '@/components/toast';
import { AuthProvider } from '@/lib/auth';
import { ResumeProvider } from '@/lib/resume-store';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  // Expo Web 빌드의 문서 언어. 콘텐츠가 전부 한국어인데 기본값이 en이다.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'ko';
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ResumeProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#f8fafc' },
                headerShadowVisible: false,
                headerTintColor: '#0f172a',
                headerTitleStyle: { fontWeight: '600', fontSize: 17 },
                contentStyle: { backgroundColor: '#f8fafc' },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="resume/[section]"
                options={{ title: '이력서' }}
              />
              <Stack.Screen name="admin/users" options={{ title: '사용자' }} />
              <Stack.Screen
                name="admin/users/[id]"
                options={{ title: '사용자 상세' }}
              />
              <Stack.Screen name="admin/audit" options={{ title: '감사 로그' }} />
            </Stack>
          </ToastProvider>
          </ResumeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
