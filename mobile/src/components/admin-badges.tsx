import { USER_ROLE_LABELS, type UserRole } from '@/types/admin';
import { Text, View } from 'react-native';

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <View
      className={`rounded-md px-2 py-0.5 ${
        role === 'ADMIN' ? 'bg-slate-900' : 'bg-slate-100'
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          role === 'ADMIN' ? 'text-white' : 'text-slate-600'
        }`}
      >
        {USER_ROLE_LABELS[role]}
      </Text>
    </View>
  );
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />
      <Text className={`text-xs ${isActive ? 'text-slate-600' : 'text-rose-600'}`}>
        {isActive ? '활성' : '비활성'}
      </Text>
    </View>
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
