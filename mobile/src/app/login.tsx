import { useToast } from '@/components/toast';
import { Button, Card, Field, Input } from '@/components/ui';
import { toErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { LogIn, Zap } from 'lucide-react-native';
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
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (mode === 'login') {
        await signIn(values.email.trim(), values.password);
      } else {
        await signUp(values.email.trim(), values.password);
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
