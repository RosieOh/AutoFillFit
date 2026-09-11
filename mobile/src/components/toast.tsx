import { AlertCircle, CheckCircle2, X } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastVariant = 'success' | 'error';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DURATION_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = nextId.current++;
      setItems((current) => [...current, { ...item, id }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        하단 탭바(약 56px)와 편집 화면의 고정 저장 버튼(약 60px) 위로 띄운다.
        zIndex를 주지 않으면 react-navigation의 탭바가 토스트를 덮는다.
      */}
      <View
        className="absolute inset-x-0 bottom-0 px-4"
        style={{
          pointerEvents: 'box-none',
          paddingBottom: insets.bottom + 68,
          zIndex: 9999,
          elevation: 24,
        }}
      >
        {items.map((item) => (
          <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const isError = item.variant === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  // 저장 결과를 알리는 순간 하나에만 모션을 쓴다.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  return (
    /*
      NativeWind는 Animated.View의 className을 처리하지 않으므로
      바깥은 애니메이션(style)만, 안쪽 View가 스타일을 담당한다.
    */
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ],
      }}
    >
      <View
        accessibilityRole="alert"
        className="mt-2 flex-row items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5"
        style={{
          shadowColor: '#0f172a',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Icon
          size={20}
          color={isError ? '#e11d48' : '#2563eb'}
          style={{ marginTop: 2 }}
        />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-slate-900">
            {item.title}
          </Text>
          {item.description ? (
            <Text className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {item.description}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onDismiss}
          accessibilityLabel="알림 닫기"
          hitSlop={8}
          className="rounded-md p-1"
        >
          <X size={16} color="#94a3b8" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있습니다.');
  }
  return context;
}
