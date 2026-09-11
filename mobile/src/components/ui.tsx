import { Loader2 } from 'lucide-react-native';
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

/** web/app/globals.css의 .card와 같은 토큰 */
export function Card({ className = '', children, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 ${className}`}
      style={{
        // RN에는 CSS box-shadow가 없어 shadow-sm에 해당하는 값을 직접 준다.
        shadowColor: '#0f172a',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
      {...props}
    >
      {children}
    </View>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * RN에는 <label for>가 없다. 스크린리더가 필드를 읽으려면 입력 자체가
 * 접근 가능한 이름을 가져야 하므로, 라벨을 자식 입력에 주입한다.
 */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const described = [hint, error].filter(Boolean).join('. ');
  const labelled = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        'aria-label': (children.props as { 'aria-label'?: string })['aria-label'] ?? label,
        'aria-invalid': Boolean(error),
        accessibilityHint: described || undefined,
      })
    : children;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-slate-700">
        {label}
        {required ? <Text className="text-blue-600"> *</Text> : null}
      </Text>

      {labelled}

      {error ? (
        <Text className="mt-1.5 text-xs text-rose-600">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-xs text-slate-500">{hint}</Text>
      ) : null}
    </View>
  );
}

type InputProps = TextInputProps & { invalid?: boolean };

/** web의 .input 토큰과 같은 형태 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { invalid, className = '', ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor="#64748b"
      className={`min-h-11 w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 ${
        invalid ? 'border-rose-400' : 'border-slate-300'
      } ${props.editable === false ? 'bg-slate-50 text-slate-500' : 'bg-white'} ${className}`}
      {...props}
    />
  );
});

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  className = '',
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const base =
    'min-h-11 flex-row items-center justify-center gap-2 rounded-lg px-4 py-3';
  const styles = {
    primary: isDisabled ? 'bg-slate-200' : 'bg-blue-600',
    ghost: `border border-slate-300 bg-white ${isDisabled ? 'opacity-60' : ''}`,
    danger: isDisabled ? 'bg-slate-200' : 'bg-rose-600',
  }[variant];

  const textStyles = {
    primary: isDisabled ? 'text-slate-500' : 'text-white',
    ghost: isDisabled ? 'text-slate-400' : 'text-slate-700',
    danger: isDisabled ? 'text-slate-500' : 'text-white',
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      className={`${base} ${styles} ${className}`}
      style={({ pressed }) => ({ opacity: pressed && !isDisabled ? 0.85 : 1 })}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? '#475569' : '#ffffff'}
        />
      ) : (
        icon
      )}
      <Text className={`text-sm font-semibold ${textStyles}`}>{label}</Text>
    </Pressable>
  );
}

/** 진행률 막대 — 값은 길이로만 표현하고 색은 하나로 고정한다. */
export function ProgressBar({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(value, 100)),
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, width]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(value), min: 0, max: 100 }}
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      {/*
        NativeWind는 Animated.View의 className을 처리하지 않는다
        (core View가 아니라 createAnimatedComponent로 감싼 컴포넌트라서).
        애니메이션 대상에는 style을 직접 준다.
      */}
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 9999,
          backgroundColor: '#2563eb',
          width: width.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
        {icon}
      </View>
      <Text className="mt-3 text-sm font-medium text-slate-900">{title}</Text>
      <Text className="mt-1 text-center text-sm text-slate-500">
        {description}
      </Text>
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}

export function LoadingScreen({ label = '불러오는 중' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator color="#2563eb" />
      <Text className="mt-3 text-sm text-slate-500">{label}</Text>
    </View>
  );
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <Text className="text-base font-semibold text-slate-900">
        불러오지 못했습니다
      </Text>
      <Text className="mt-1 text-sm text-slate-500">{message}</Text>
      <Button
        label="다시 시도"
        variant="ghost"
        onPress={onRetry}
        className="mt-4 self-start"
      />
    </Card>
  );
}

/** lucide 아이콘을 회전시켜 로딩 표시로 쓸 때 */
export function Spinner({ size = 16, color = '#64748b' }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: spin.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ],
      }}
    >
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}
