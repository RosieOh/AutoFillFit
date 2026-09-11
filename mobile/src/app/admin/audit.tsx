import { AuthGate } from '@/components/auth-gate';
import { formatDateTime } from '@/components/admin-badges';
import { Card, EmptyState, ErrorPanel } from '@/components/ui';
import { api, toErrorMessage } from '@/lib/api';
import {
  ADMIN_ACTION_LABELS,
  USER_ROLE_LABELS,
  type AdminAuditLog,
  type Paginated,
  type UserRole,
} from '@/types/admin';
import { Eye, ScrollText, ShieldCheck, Trash2, UserX } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

const ACTION_ICONS = {
  REVEAL_PII: Eye,
  UPDATE_ROLE: ShieldCheck,
  UPDATE_STATUS: UserX,
  DELETE_USER: Trash2,
} as const;

function AdminAuditScreenInner() {
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const { data } = await api.get<Paginated<AdminAuditLog>>(
        '/admin/audit-logs',
        { params: { page: targetPage, limit: 30 } },
      );

      setItems((current) => (append ? [...current, ...data.items] : data.items));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(toErrorMessage(err, '감사 로그를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(1, false);
  }, [load]);

  if (error && items.length === 0) {
    return (
      <View className="flex-1 bg-slate-50 p-5">
        <ErrorPanel message={error} onRetry={() => void load(1, false)} />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-5 gap-3"
      data={items}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={() => void load(1, false)}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (!loadingMore && !loading && page < totalPages) {
          void load(page + 1, true);
        }
      }}
      ListHeaderComponent={
        <Text className="mb-1 text-xs text-slate-500">
          개인정보 열람과 계정 변경 기록입니다. 삭제하거나 수정할 수 없습니다.
        </Text>
      }
      ListEmptyComponent={
        loading ? null : (
          <EmptyState
            icon={<ScrollText size={20} color="#94a3b8" />}
            title="아직 기록이 없습니다"
            description="관리자가 개인정보를 열람하거나 계정을 변경하면 여기에 남습니다."
          />
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View className="py-4">
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const Icon = ACTION_ICONS[item.action] ?? ScrollText;
        const isReveal = item.action === 'REVEAL_PII';

        return (
          <Card className="flex-row items-start gap-3 p-4">
            <View
              className={`h-8 w-8 items-center justify-center rounded-full ${
                isReveal ? 'bg-amber-50' : 'bg-slate-100'
              }`}
            >
              <Icon size={16} color={isReveal ? '#d97706' : '#64748b'} />
            </View>

            <View className="min-w-0 flex-1">
              <Text className="text-sm text-slate-900" numberOfLines={1}>
                {item.actorEmail}
                <Text className="text-slate-500">
                  {' '}
                  → {ADMIN_ACTION_LABELS[item.action]}
                </Text>
              </Text>
              <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={2}>
                대상 {item.targetEmail ?? '알 수 없음'}
                {formatDetail(item)}
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                {formatDateTime(item.createdAt)}
                {item.ipAddress ? ` · ${item.ipAddress}` : ''}
              </Text>
            </View>
          </Card>
        );
      }}
    />
  );
}

function formatDetail(log: AdminAuditLog): string {
  const detail = log.detail;
  if (!detail) return '';

  if (log.action === 'UPDATE_ROLE') {
    return ` · ${roleLabel(detail.from)} → ${roleLabel(detail.to)}`;
  }
  if (log.action === 'UPDATE_STATUS') {
    return ` · ${detail.from ? '활성' : '비활성'} → ${
      detail.to ? '활성' : '비활성'
    }`;
  }
  if (log.action === 'REVEAL_PII' && Array.isArray(detail.fields)) {
    return ` · ${(detail.fields as string[]).map(fieldLabel).join(', ')}`;
  }
  return '';
}

function roleLabel(value: unknown): string {
  return USER_ROLE_LABELS[value as UserRole] ?? String(value);
}

const FIELD_LABELS: Record<string, string> = {
  profile: '인적사항',
  essays: '자소서 본문',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export default function AdminAuditScreen() {
  return (
    <AuthGate requireAdmin >
      <AdminAuditScreenInner />
    </AuthGate>
  );
}
