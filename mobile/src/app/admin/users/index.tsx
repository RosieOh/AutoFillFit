import { AuthGate } from '@/components/auth-gate';
import { RoleBadge, StatusBadge, formatDate } from '@/components/admin-badges';
import { Card, EmptyState, ErrorPanel, Input } from '@/components/ui';
import { api, toErrorMessage } from '@/lib/api';
import type { AdminUserRow, Paginated } from '@/types/admin';
import { useRouter } from 'expo-router';
import { ChevronRight, EyeOff, Search, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

const PAGE_SIZE = 20;

function AdminUsersScreenInner() {
  const router = useRouter();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const { data } = await api.get<Paginated<AdminUserRow>>('/admin/users', {
          params: {
            page: targetPage,
            limit: PAGE_SIZE,
            sort: 'createdAt',
            order: 'desc',
            ...(search ? { q: search } : {}),
          },
        });

        setItems((current) => (append ? [...current, ...data.items] : data.items));
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(toErrorMessage(err, '사용자 목록을 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search],
  );

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
    <View className="flex-1 bg-slate-50">
      <View className="gap-3 px-5 pb-3 pt-4">
        <View className="flex-row items-center gap-2">
          <View className="relative flex-1">
            <View className="absolute left-3 top-0 bottom-0 z-10 justify-center">
              <Search size={16} color="#94a3b8" />
            </View>
            <Input
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => setSearch(query.trim())}
              placeholder="이메일로 검색"
              returnKeyType="search"
              autoCapitalize="none"
              className="pl-9"
            />
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-slate-500">
            {loading ? '불러오는 중' : `${total.toLocaleString()}명`}
          </Text>
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
            <EyeOff size={12} color="#475569" />
            <Text className="text-xs text-slate-600">이름 · 이메일 마스킹됨</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-8 gap-3"
        refreshing={loading}
        onRefresh={() => void load(1, false)}
        // 모바일에서는 페이지 버튼보다 무한 스크롤이 자연스럽다.
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loadingMore && !loading && page < totalPages) {
            void load(page + 1, true);
          }
        }}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon={<Users size={20} color="#94a3b8" />}
              title="조건에 맞는 사용자가 없습니다"
              description="검색어를 바꿔 보세요."
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
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/admin/users/${item.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card className="p-4">
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-sm font-medium text-slate-900"
                    numberOfLines={1}
                  >
                    {item.name ?? '이름 없음'}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>
                <RoleBadge role={item.role} />
                <ChevronRight size={16} color="#cbd5e1" />
              </View>

              <View className="mt-3 flex-row items-center gap-3">
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <View
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${item.completeness}%` }}
                  />
                </View>
                <Text className="text-xs font-medium text-slate-700">
                  {item.completeness}%
                </Text>
                <StatusBadge isActive={item.isActive} />
                <Text className="text-xs text-slate-500">
                  {formatDate(item.createdAt)}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

export default function AdminUsersScreen() {
  return (
    <AuthGate requireAdmin >
      <AdminUsersScreenInner />
    </AuthGate>
  );
}
