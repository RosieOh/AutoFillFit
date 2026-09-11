import { AuthGate } from '@/components/auth-gate';
import { SECTIONS } from '@/app/(tabs)/index';
import { CertificateSection } from '@/components/sections/certificate-section';
import { EssaySection } from '@/components/sections/essay-section';
import { HistorySection } from '@/components/sections/history-section';
import { ProfileSection } from '@/components/sections/profile-section';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import type { SectionKey } from '@/lib/completeness';
import { useResume } from '@/lib/resume-store';
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFormState } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREENS: Record<SectionKey, () => React.JSX.Element> = {
  profile: ProfileSection,
  history: HistorySection,
  certificates: CertificateSection,
  essays: EssaySection,
};

function ResumeSectionScreenInner() {
  const { section } = useLocalSearchParams<{ section: SectionKey }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { save } = useResume();
  const { isDirty } = useFormState();
  const [saving, setSaving] = useState(false);
  const navigation = useNavigation();

  /**
   * 자소서를 쓰다 뒤로가기를 누르면 전부 사라진다.
   * 저장 후 router.back()은 이미 dirty가 아니므로 여기 걸리지 않는다.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isDirty) return;

      event.preventDefault();
      Alert.alert(
        '저장하지 않고 나갈까요?',
        '입력한 내용이 사라집니다.',
        [
          { text: '계속 작성', style: 'cancel' },
          {
            text: '나가기',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation, isDirty]);

  const meta = SECTIONS.find((item) => item.key === section);
  const Screen = section ? SCREENS[section] : undefined;

  if (!Screen) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-sm text-slate-500">
          알 수 없는 항목입니다.
        </Text>
      </View>
    );
  }

  const onSave = async () => {
    setSaving(true);
    const result = await save();
    setSaving(false);

    if (result.ok) {
      toast({
        variant: 'success',
        title: '이력서를 저장했습니다',
        description: '확장 프로그램이 다음 지원서부터 새 정보를 사용합니다.',
      });
      router.back();
    } else {
      toast({
        variant: 'error',
        title: '저장하지 못했습니다',
        description: result.message,
      });
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: meta?.label ?? '이력서' }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
        className="flex-1 bg-slate-50"
      >
        <ScrollView
          contentContainerClassName="p-5 pb-8 gap-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Screen />
        </ScrollView>

        {/* 긴 폼에서는 저장 버튼이 항상 손 닿는 곳에 있어야 한다. */}
        <View
          className="border-t border-slate-200/80 bg-white px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Button
            label={saving ? '저장 중' : isDirty ? '저장하기' : '변경사항 없음'}
            onPress={() => void onSave()}
            loading={saving}
            disabled={!isDirty}
            icon={<Save size={16} color="#ffffff" />}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

export default function ResumeSectionScreen() {
  return (
    <AuthGate >
      <ResumeSectionScreenInner />
    </AuthGate>
  );
}
