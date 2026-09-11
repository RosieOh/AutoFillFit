import { Card, ErrorPanel, ProgressBar } from '@/components/ui';
import type { SectionKey } from '@/lib/completeness';
import { useResume } from '@/lib/resume-store';
import { useRouter } from 'expo-router';
import {
  Award,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  Monitor,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

interface SectionNav {
  key: SectionKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SECTIONS: SectionNav[] = [
  {
    key: 'profile',
    label: '기본 인적사항',
    description: '이름 · 연락처 · 주소',
    icon: User,
  },
  {
    key: 'history',
    label: '학력 / 경력',
    description: '학교와 회사 이력',
    icon: GraduationCap,
  },
  {
    key: 'certificates',
    label: '자격증',
    description: '자격증 · 어학 점수',
    icon: Award,
  },
  {
    key: 'essays',
    label: '마스터 자소서',
    description: '문항별 답변',
    icon: FileText,
  },
];

export default function ResumeHomeScreen() {
  const router = useRouter();
  const { state, error, completeness, reload, savedAt } = useResume();
  const loading = state === 'loading';
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  if (state === 'error') {
    return (
      <View className="flex-1 bg-slate-50 p-5">
        <ErrorPanel message={error ?? ''} onRetry={() => void reload()} />
      </View>
    );
  }

  const { total, weakest } = completeness;
  const weakestLabel = weakest
    ? SECTIONS.find((section) => section.key === weakest.key)?.label
    : null;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-5 gap-4"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor="#2563eb"
        />
      }
    >
      <Card>
        <Text className="text-sm font-medium text-slate-500">
          내 이력 완성도
        </Text>
        <View className="mt-1 flex-row items-baseline gap-2">
          <Text className="text-4xl font-semibold tracking-tight text-slate-900">
            {total}%
          </Text>
          <Text className="text-sm text-slate-500">
            {total >= 100 ? '모든 항목을 채웠습니다' : `${100 - total}% 남았습니다`}
          </Text>
        </View>

        <ProgressBar value={total} className="mt-4" />

        {/* 퍼센트의 근거를 드러낸다 — 어디서 점수가 빠졌는지 보이게. */}
        <View className="mt-4 gap-2">
          {completeness.sections.map((section) => {
            const label = SECTIONS.find((s) => s.key === section.key)?.label;
            const done = section.earned >= section.weight;

            return (
              <View key={section.key} className="flex-row items-center gap-2">
                <View
                  className={`h-1.5 w-1.5 rounded-full ${
                    done
                      ? 'bg-blue-600'
                      : section.earned > 0
                        ? 'bg-blue-300'
                        : 'bg-slate-300'
                  }`}
                />
                <Text className="flex-1 text-xs text-slate-500">{label}</Text>
                <Text className="text-xs font-medium text-slate-700">
                  {Math.round(section.earned)}
                  <Text className="text-slate-500">/{section.weight}</Text>
                </Text>
              </View>
            );
          })}
        </View>

        <Text className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {loading
            ? '불러오는 중'
            : savedAt
              ? `마지막 저장 ${formatSavedAt(savedAt)}`
              : '아직 저장한 이력서가 없습니다'}
        </Text>
      </Card>

      {/* 남은 점수가 가장 큰 섹션으로 바로 보낸다. */}
      {weakest?.nextAction ? (
        <Pressable
          onPress={() => router.push(`/resume/${weakest.key}`)}
          className="flex-row items-center gap-2 rounded-xl bg-blue-50 px-4 py-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-sm font-medium text-blue-800">
            {weakestLabel}
          </Text>
          <Text className="flex-1 text-sm text-blue-700">
            {weakest.nextAction}
          </Text>
          <ChevronRight size={16} color="#1d4ed8" />
        </Pressable>
      ) : null}

      {/*
        확장 프로그램은 데스크톱 Chrome에서만 동작한다.
        앱에서 연결 상태를 꾸며내지 않고, 이 이력서가 어디에 쓰이는지만 밝힌다.
      */}
      <Card className="flex-row items-start gap-3 p-4">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <Monitor size={18} color="#2563eb" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-slate-900">
            지원서는 데스크톱에서 채워집니다
          </Text>
          <Text className="mt-1 text-xs leading-relaxed text-slate-600">
            여기서 저장한 이력서를 PC Chrome의 확장 프로그램이 읽어 채용 사이트
            지원서를 채웁니다. PC에서 대시보드를 열면 확장에 전달됩니다.
          </Text>
        </View>
      </Card>

      <View className="gap-3">
        {SECTIONS.map((section) => {
          const score = completeness.sections.find((s) => s.key === section.key);
          const done = score ? score.earned >= score.weight : false;
          const Icon = section.icon;

          return (
            <Pressable
              key={section.key}
              onPress={() => router.push(`/resume/${section.key}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card className="flex-row items-center gap-3 p-4">
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
                  <Icon size={18} color="#64748b" />
                </View>

                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium text-slate-900">
                    {section.label}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    {section.description}
                  </Text>
                </View>

                {loading ? (
                  <View className="h-3 w-8 rounded bg-slate-200" />
                ) : done ? (
                  <Check size={18} color="#2563eb" />
                ) : (
                  <Text className="text-xs font-medium text-slate-500">
                    {Math.round(score?.earned ?? 0)}/{score?.weight ?? 0}
                  </Text>
                )}
                <ChevronRight size={16} color="#cbd5e1" />
              </Card>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '방금';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
