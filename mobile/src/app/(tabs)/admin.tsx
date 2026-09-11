import { Card, ErrorPanel, LoadingScreen, ProgressBar } from '@/components/ui';
import { api, toErrorMessage } from '@/lib/api';
import type { AdminStats, SectionBreakdown } from '@/types/admin';
import { useRouter } from 'expo-router';
import { ChevronRight, ScrollText, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

const SECTION_LABELS: Record<keyof SectionBreakdown, string> = {
  profile: '기본 인적사항',
  history: '학력 / 경력',
  certificates: '자격증',
  essays: '마스터 자소서',
};

export default function AdminOverviewScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<AdminStats>('/admin/stats');
      setStats(data);
    } catch (err) {
      setError(toErrorMessage(err, '지표를 불러오지 못했습니다.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <View className="flex-1 bg-slate-50 p-5">
        <ErrorPanel message={error} onRetry={() => void load()} />
      </View>
    );
  }

  if (!stats) return <LoadingScreen label="지표 불러오는 중" />;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-5 gap-4"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor="#2563eb"
        />
      }
    >
      <Text className="text-xs text-slate-500">
        집계 값만 표시합니다. 개인정보는 포함되지 않습니다.
      </Text>

      <View className="flex-row flex-wrap gap-3">
        <StatTile
          label="전체 사용자"
          value={stats.totals.users}
          unit="명"
          sub={`활성 ${stats.totals.active} · 비활성 ${stats.totals.inactive}`}
        />
        <StatTile
          label="이력서 보유"
          value={stats.totals.withResume}
          unit="명"
          sub={`전체의 ${percent(stats.totals.withResume, stats.totals.users)}%`}
        />
        <StatTile
          label="평균 완성도"
          value={stats.completeness.average}
          unit="%"
          sub="100점 만점 기준"
        />
        <StatTile
          label="최근 7일 가입"
          value={stats.signups.last7Days}
          unit="명"
          sub={`30일 ${stats.signups.last30Days}명`}
        />
      </View>

      <SignupTrend data={stats.signupTrend} />

      <Card>
        <Text className="text-sm font-medium text-slate-500">완성도 분포</Text>
        <Text className="mb-4 mt-1 text-xs text-slate-500">
          구간별 사용자 수 · 전체 {stats.totals.users.toLocaleString()}명
        </Text>

        {stats.completeness.distribution.map((item) => {
          const max = Math.max(
            ...stats.completeness.distribution.map((d) => d.count),
            1,
          );

          return (
            <View key={item.bucket} className="mb-3 flex-row items-center gap-3">
              <Text className="w-14 text-xs text-slate-500">{item.bucket}%</Text>
              <View className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <View
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </View>
              <Text className="w-12 text-right text-xs font-medium text-slate-900">
                {item.count}명
              </Text>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text className="text-sm font-medium text-slate-500">
          어디에서 점수가 빠지는가
        </Text>
        <Text className="mb-4 mt-1 text-xs text-slate-500">
          섹션별 평균 획득 점수 / 배점
        </Text>

        {(Object.keys(SECTION_LABELS) as (keyof SectionBreakdown)[]).map((key) => {
          const earned = stats.completeness.sectionAverages[key];
          const weight = stats.completeness.sectionWeights[key];

          return (
            <View key={key} className="mb-3">
              <View className="mb-1.5 flex-row items-baseline justify-between">
                <Text className="text-xs text-slate-600">
                  {SECTION_LABELS[key]}
                </Text>
                <Text className="text-xs font-medium text-slate-900">
                  {earned}
                  <Text className="text-slate-500"> / {weight}</Text>
                </Text>
              </View>
              <ProgressBar value={weight ? (earned / weight) * 100 : 0} />
            </View>
          );
        })}
      </Card>

      <View className="gap-3">
        <NavRow
          icon={<Users size={18} color="#64748b" />}
          label="사용자"
          description="검색 · 상세 · 계정 관리"
          onPress={() => router.push('/admin/users')}
        />
        <NavRow
          icon={<ScrollText size={18} color="#64748b" />}
          label="감사 로그"
          description="개인정보 열람 · 계정 변경 기록"
          onPress={() => router.push('/admin/audit')}
        />
      </View>
    </ScrollView>
  );
}

function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function StatTile({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
}) {
  return (
    <Card className="min-w-[45%] flex-1 p-4">
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
      <View className="mt-2 flex-row items-baseline gap-1">
        <Text className="text-2xl font-semibold tracking-tight text-slate-900">
          {value.toLocaleString()}
        </Text>
        <Text className="text-sm text-slate-500">{unit}</Text>
      </View>
      <Text className="mt-1 text-xs text-slate-500" numberOfLines={1}>
        {sub}
      </Text>
    </Card>
  );
}

/**
 * 최근 30일 일별 가입.
 * 단일 계열이라 색은 정보를 나르지 않는다 — 길이가 값이고 색은 하나다.
 */
function SignupTrend({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((point) => point.count), 1);
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <Card>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-sm font-medium text-slate-500">
            최근 30일 가입
          </Text>
          <View className="mt-1 flex-row items-baseline gap-2">
            <Text className="text-3xl font-semibold tracking-tight text-slate-900">
              {total.toLocaleString()}
            </Text>
            <Text className="text-sm text-slate-500">명</Text>
          </View>
        </View>
        <Text className="text-xs text-slate-500">
          하루 최대 <Text className="font-medium text-slate-900">{max}명</Text>
        </Text>
      </View>

      <View
        className="mt-5 h-24 flex-row items-end gap-[2px]"
        accessibilityRole="image"
        accessibilityLabel={`최근 30일 일별 가입자 수. 총 ${total}명, 하루 최대 ${max}명.`}
      >
        {data.map((point) => (
          <View
            key={point.date}
            className={`flex-1 rounded-t ${
              point.count === 0 ? 'bg-slate-100' : 'bg-blue-600'
            }`}
            // 값이 0인 날도 자리를 차지해야 시간축이 왜곡되지 않는다.
            style={{
              height: point.count === 0 ? 2 : `${Math.max((point.count / max) * 100, 4)}%`,
            }}
          />
        ))}
      </View>

      <View className="mt-2 flex-row justify-between">
        <Text className="text-xs text-slate-500">{formatDay(data[0]?.date)}</Text>
        <Text className="text-xs text-slate-500">
          {formatDay(data[data.length - 1]?.date)}
        </Text>
      </View>
    </Card>
  );
}

function formatDay(date: string | undefined): string {
  if (!date) return '';
  const [, month, day] = date.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function NavRow({
  icon,
  label,
  description,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card className="flex-row items-center gap-3 p-4">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
          {icon}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-slate-900">{label}</Text>
          <Text className="mt-0.5 text-xs text-slate-500">{description}</Text>
        </View>
        <ChevronRight size={16} color="#cbd5e1" />
      </Card>
    </Pressable>
  );
}
