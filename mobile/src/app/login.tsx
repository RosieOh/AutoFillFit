import { useToast } from '@/components/toast';
import { Button, Card, Field, Input } from '@/components/ui';
import { toErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { Check, LogIn, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LoginFormValues {
  email: string;
  password: string;
  /** 가입 시에만 쓰는 필수 동의 (개인정보보호법 제15조) */
  termsAgreed: boolean;
  privacyAgreed: boolean;
}

export default function LoginScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
      termsAgreed: false,
      privacyAgreed: false,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (mode === 'login') {
        await signIn(values.email.trim(), values.password);
      } else {
        await signUp(values.email.trim(), values.password, {
          termsAgreed: values.termsAgreed,
          privacyAgreed: values.privacyAgreed,
        });
      }
      router.replace('/(tabs)');
    } catch (error) {
      toast({
        variant: 'error',
        title: mode === 'login' ? '로그인하지 못했습니다' : '가입하지 못했습니다',
        description: toErrorMessage(error, '잠시 후 다시 시도해 주세요.'),
      });
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-12"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 flex-row items-center gap-2.5">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Zap size={18} color="#ffffff" />
            </View>
            <Text className="text-[15px] font-semibold text-slate-900">
              AutoFill-Fit
            </Text>
          </View>

          <Card>
            <Text className="text-lg font-semibold text-slate-900">
              {mode === 'login' ? '다시 오셨네요' : '계정 만들기'}
            </Text>
            <Text className="mb-6 mt-1 text-sm text-slate-500">
              {mode === 'login'
                ? '저장해 둔 이력서를 불러옵니다.'
                : '이력서를 저장할 계정을 만듭니다.'}
            </Text>

            <Controller
              control={control}
              name="email"
              rules={{
                required: '이메일을 입력해 주세요.',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: '올바른 이메일 형식이 아닙니다.',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field label="이메일" required error={errors.email?.message}>
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    invalid={Boolean(errors.email)}
                    placeholder="hong@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{
                required: '비밀번호를 입력해 주세요.',
                minLength: { value: 8, message: '8자 이상 입력해 주세요.' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label="비밀번호"
                  required
                  hint={mode === 'signup' ? '영문과 숫자를 포함해 8자 이상' : undefined}
                  error={errors.password?.message}
                >
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    invalid={Boolean(errors.password)}
                    placeholder="••••••••"
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType={mode === 'login' ? 'password' : 'newPassword'}
                  />
                </Field>
              )}
            />

            {mode === 'signup' ? (
              <View className="gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <Controller
                  control={control}
                  name="termsAgreed"
                  rules={{ required: '이용약관에 동의해야 가입할 수 있습니다.' }}
                  render={({ field }) => (
                    <ConsentRow
                      checked={field.value}
                      onToggle={() => field.onChange(!field.value)}
                      label="이용약관에 동의합니다 (필수)"
                      error={errors.termsAgreed?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="privacyAgreed"
                  rules={{
                    required: '개인정보 수집·이용에 동의해야 가입할 수 있습니다.',
                  }}
                  render={({ field }) => (
                    <ConsentRow
                      checked={field.value}
                      onToggle={() => field.onChange(!field.value)}
                      label="개인정보 수집·이용에 동의합니다 (필수)"
                      error={errors.privacyAgreed?.message}
                    />
                  )}
                />
                <Text className="text-xs leading-relaxed text-slate-500">
                  이름·연락처·생년월일·주소와 자기소개서 내용을 보관합니다.
                  탈퇴하면 모두 삭제됩니다.
                </Text>
              </View>
            ) : null}

            <Button
              label={mode === 'login' ? '로그인' : '가입하고 시작하기'}
              onPress={() => void onSubmit()}
              loading={isSubmitting}
              icon={<LogIn size={16} color="#ffffff" />}
              className="mt-2"
            />
          </Card>

          <View className="mt-4 flex-row justify-center gap-1.5">
            <Text className="text-sm text-slate-500">
              {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            </Text>
            <Pressable
              onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
              hitSlop={8}
            >
              <Text className="text-sm font-medium text-blue-600">
                {mode === 'login' ? '가입하기' : '로그인하기'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * 동의 한 줄.
 *
 * 스위치 대신 체크박스 모양을 쓴다. 스위치는 '설정 켜기/끄기'로 읽히고
 * 동의는 한 번 선택하는 행위라서, 형태가 의미를 잘못 전달한다.
 */
function ConsentRow({
  checked,
  onToggle,
  label,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  error?: string;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        className="min-h-11 flex-row items-center gap-2.5"
      >
        <View
          className={`h-5 w-5 items-center justify-center rounded border ${
            checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
          }`}
        >
          {checked ? <Check size={14} color="#ffffff" /> : null}
        </View>
        <Text className="flex-1 text-sm text-slate-700">{label}</Text>
      </Pressable>
      {error ? <Text className="text-xs text-rose-600">{error}</Text> : null}
    </View>
  );
}
