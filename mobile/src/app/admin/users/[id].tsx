import { AuthGate } from '@/components/auth-gate';
import { RoleBadge, StatusBadge, formatDate } from '@/components/admin-badges';
import { useToast } from '@/components/toast';
import { Button, Card, ErrorPanel, LoadingScreen } from '@/components/ui';
import { api, toErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AdminUserDetail, SectionBreakdown } from '@/types/admin';
import { EDUCATION_DEGREE_LABELS, ESSAY_TYPE_LABELS } from '@/types/resume';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

/** server/src/admin/dto/admin.dto.ts의 RevealReason과 같은 값 */
const REVEAL_REASONS = [
  { value: 'SUPPORT', label: '문의 대응' },
  { value: 'ABUSE_REPORT', label: '신고 조사' },
  { value: 'USER_REQUEST', label: '본인 요청' },
] as const;

const SECTION_LABELS: Record<keyof SectionBreakdown, string> = {
  profile: '기본 인적사항',
  history: '학력 / 경력',
  certificates: '자격증',
  essays: '마스터 자소서',
};

/** 배점 — server/src/admin/utils/completeness.util.ts와 같은 값 */
const SECTION_WEIGHTS: SectionBreakdown = {
  profile: 30,
  history: 40,
  certificates: 10,
  essays: 20,
};

function AdminUserDetailScreenInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { me } = useAuth();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    async (reveal: boolean, reason?: string) => {
      setError(null);
      try {
        const { data } = await api.get<AdminUserDetail>(`/admin/users/${id}`, {
          params: reveal ? { reveal: true, reason } : {},
        });
        setDetail(data);
      } catch (err) {
        setError(toErrorMessage(err, '사용자를 불러오지 못했습니다.'));
      }
    },
    [id],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /** 사유를 고르게 한 뒤에만 원본을 연다 — 사유 없는 열람은 서버가 거부한다. */
  const promptReveal = () => {
    Alert.alert(
      '개인정보 원본을 열람할까요?',
      [
        '이름 · 연락처 · 생년월일 · 주소와 자기소개서 본문이 표시됩니다.',
        '열람 사실과 사유가 감사 로그에 남습니다.',
        '',
        '열람 사유를 선택해 주세요.',
      ].join('\n'),
      [
        { text: '취소', style: 'cancel' },
        ...REVEAL_REASONS.map((reason) => ({
          text: reason.label,
          onPress: () => void handleReveal(reason.value, reason.label),
        })),
      ],
    );
  };

  const handleReveal = async (reason: string, reasonLabel: string) => {
    setRevealing(true);
    await load(true, reason);
    setRevealing(false);
    toast({
      variant: 'success',
      title: '개인정보를 열람했습니다',
      description: `사유 "${reasonLabel}"와 함께 감사 로그에 기록되었습니다.`,
    });
  };

  const handleUpdate = async (patch: { role?: string; isActive?: boolean }) => {
    setPending(true);
    try {
      await api.patch(`/admin/users/${id}`, patch);
      await load(false);
      toast({ variant: 'success', title: '변경했습니다' });
    } catch (err) {
      toast({
        variant: 'error',
        title: '변경하지 못했습니다',
        description: toErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
      });
    } finally {
      setPending(false);
    }
  };

  /** 되돌릴 수 없는 작업이라 네이티브 확인 대화상자를 거친다. */
  const confirmDelete = () => {
    Alert.alert(
      '이 계정을 삭제할까요?',
      // 마스킹된 이메일은 서로 구분되지 않으므로 ID와 가입일을 함께 보여준다.
      `${detail?.user.email ?? ''}
가입 ${formatDate(
        detail?.user.createdAt ?? null,
      )} · ID ${detail?.user.id.slice(0, 8) ?? ''}

계정과 프로필, 이력서가 모두 삭제됩니다. 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => void handleDelete(),
        },
      ],
    );
  };

  const handleDelete = async () => {
    setPending(true);
    try {
      await api.delete(`/admin/users/${id}`);
      toast({
        variant: 'success',
        title: '계정을 삭제했습니다',
        description: '프로필과 이력서도 함께 삭제되었습니다.',
      });
      router.back();
    } catch (err) {
      toast({
        variant: 'error',
        title: '삭제하지 못했습니다',
        description: toErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
      });
      setPending(false);
    }
  };

  if (error) {
    return (
      <View className="flex-1 bg-slate-50 p-5">
        <ErrorPanel message={error} onRetry={() => void load(false)} />
      </View>
    );
  }

  if (!detail) return <LoadingScreen />;

  const { user, profile, resume, completeness, masked } = detail;
  const isSelf = me?.id === user.id;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-5 gap-4"
    >
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-semibold text-slate-900" numberOfLines={1}>
              {profile?.name ?? '이름 없음'}
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
              {user.email}
            </Text>
            <Text className="mt-1 text-[11px] text-slate-500">
              ID {user.id.slice(0, 8)}
            </Text>
          </View>
          <View className="items-end gap-2">
            <RoleBadge role={user.role} />
            <StatusBadge isActive={user.isActive} />
          </View>
        </View>

        <Text className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          가입 {formatDate(user.createdAt)}
        </Text>
      </Card>

      {/* 마스킹 상태와 해제 경로를 화면 위쪽에 명시한다. */}
      <View
        className={`rounded-xl border px-4 py-3 ${
          masked ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <View className="flex-row items-center gap-2">
          {masked ? (
            <EyeOff size={16} color="#94a3b8" />
          ) : (
            <Eye size={16} color="#d97706" />
          )}
          <Text
            className={`flex-1 text-sm ${
              masked ? 'text-slate-600' : 'text-amber-900'
            }`}
          >
            {masked
              ? '이름 · 연락처 · 생년월일 · 주소 · 자소서 본문이 가려져 있습니다. 학력 · 경력 · 자격증은 그대로 표시됩니다.'
              : '원본을 표시 중입니다. 이 열람은 감사 로그에 기록되었습니다.'}
          </Text>
        </View>

        <Button
          label={masked ? '원본 보기' : '다시 가리기'}
          variant="ghost"
          loading={revealing}
          onPress={() => (masked ? promptReveal() : void load(false))}
          icon={
            masked ? (
              <Eye size={16} color="#475569" />
            ) : (
              <EyeOff size={16} color="#475569" />
            )
          }
          className="mt-3"
        />
      </View>

      <Card>
        <Text className="mb-4 text-base font-semibold text-slate-900">
          기본 인적사항
        </Text>
        {profile ? (
          <>
            <Detail label="이름" value={profile.name} />
            <Detail label="연락처" value={profile.phone} />
            <Detail label="생년월일" value={profile.birthdate} />
            <Detail label="우편번호" value={profile.zipCode} />
            <Detail label="주소" value={profile.address} />
          </>
        ) : (
          <Text className="text-sm text-slate-500">
            작성된 인적사항이 없습니다.
          </Text>
        )}
      </Card>

      <Card>
        <Text className="text-sm font-medium text-slate-500">이력 완성도</Text>
        <Text className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          {completeness.total}%
        </Text>

        <View className="mt-4 gap-2">
          {(Object.keys(SECTION_LABELS) as (keyof SectionBreakdown)[]).map(
            (key) => (
              <View key={key} className="flex-row items-center justify-between">
                <Text className="text-xs text-slate-500">
                  {SECTION_LABELS[key]}
                </Text>
                <Text className="text-xs font-medium text-slate-700">
                  {Math.round(completeness.sections[key])}
                  <Text className="text-slate-500">
                    {' / '}
                    {key === 'history' && completeness.careerExcluded
                      ? SECTION_WEIGHTS.history - 20
                      : SECTION_WEIGHTS[key]}
                  </Text>
                </Text>
              </View>
            ),
          )}
        </View>
      </Card>

      {resume ? (
        <>
          <Card>
            <Text className="mb-4 text-base font-semibold text-slate-900">
              학력 · 경력 · 자격증
            </Text>

            <Group label="학력" empty="등록된 학력이 없습니다.">
              {resume.education.map((item, index) => (
                <Row
                  key={index}
                  title={item.schoolName}
                  meta={[
                    item.major,
                    item.degree ? EDUCATION_DEGREE_LABELS[item.degree] : null,
                    item.admissionDate && item.graduationDate
                      ? `${item.admissionDate} ~ ${item.graduationDate}`
                      : null,
                  ]}
                />
              ))}
            </Group>

            <Group label="경력" empty="등록된 경력이 없습니다.">
              {resume.careers.map((item, index) => (
                <Row
                  key={index}
                  title={item.companyName}
                  meta={[
                    item.jobTitle,
                    item.department,
                    item.joinDate
                      ? `${item.joinDate} ~ ${
                          item.isCurrent ? '재직 중' : (item.leaveDate ?? '')
                        }`
                      : null,
                  ]}
                />
              ))}
            </Group>

            <Group label="자격증" empty="등록된 자격증이 없습니다.">
              {resume.certificates.map((item, index) => (
                <Row
                  key={index}
                  title={item.name}
                  meta={[item.issuer, item.acquiredAt, item.score]}
                />
              ))}
            </Group>
          </Card>

          <Card>
            <Text className="text-base font-semibold text-slate-900">
              마스터 자소서
            </Text>
            <Text className="mb-4 mt-1 text-sm text-slate-500">
              본문은 원본 열람 시에만 표시됩니다.
            </Text>

            {resume.essays.length === 0 ? (
              <Text className="text-sm text-slate-500">
                등록된 문항이 없습니다.
              </Text>
            ) : (
              <View className="gap-3">
                {resume.essays.map((essay, index) => (
                  <View
                    key={index}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <View className="flex-row items-baseline justify-between gap-2">
                      <Text
                        className="min-w-0 flex-1 text-sm font-medium text-slate-900"
                        numberOfLines={2}
                      >
                        {essay.title}
                      </Text>
                      <Text className="text-xs text-slate-500">
                        {essay.type ? `${ESSAY_TYPE_LABELS[essay.type]} · ` : ''}
                        {essay.contentLength.toLocaleString()}자
                      </Text>
                    </View>

                    {essay.content ? (
                      <Text className="mt-3 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-700">
                        {essay.content}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <Text className="text-sm text-slate-500">작성된 이력서가 없습니다.</Text>
        </Card>
      )}

      <Card className="border-rose-200/80">
        <Text className="text-base font-semibold text-slate-900">계정 관리</Text>
        <Text className="mb-5 mt-1 text-sm text-slate-500">
          {isSelf
            ? '자신의 계정은 백오피스에서 변경할 수 없습니다.'
            : '변경 내역은 모두 감사 로그에 남습니다.'}
        </Text>

        <View className="gap-2">
          <Button
            label={user.isActive ? '계정 비활성화' : '계정 활성화'}
            variant="ghost"
            disabled={isSelf || pending}
            onPress={() => void handleUpdate({ isActive: !user.isActive })}
            icon={
              user.isActive ? (
                <UserX size={16} color="#475569" />
              ) : (
                <UserCheck size={16} color="#475569" />
              )
            }
          />
          <Button
            label={user.role === 'ADMIN' ? '관리자 권한 회수' : '관리자로 승격'}
            variant="ghost"
            disabled={isSelf || pending}
            onPress={() =>
              void handleUpdate({
                role: user.role === 'ADMIN' ? 'USER' : 'ADMIN',
              })
            }
            icon={<ShieldCheck size={16} color="#475569" />}
          />
          <Button
            label="계정 삭제"
            variant="danger"
            disabled={isSelf || pending}
            onPress={confirmDelete}
            icon={<Trash2 size={16} color="#ffffff" />}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View className="mb-3 flex-row items-baseline justify-between gap-4">
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
      <Text
        className={`flex-1 text-right text-sm ${
          value ? 'text-slate-900' : 'text-slate-400'
        }`}
      >
        {value || '입력 없음'}
      </Text>
    </View>
  );
}

function Group({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const items = children.filter(Boolean);

  return (
    <View className="mb-5">
      <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </Text>
      {items.length === 0 ? (
        <Text className="mt-2 text-sm text-slate-500">{empty}</Text>
      ) : (
        <View className="mt-2 gap-2">{items}</View>
      )}
    </View>
  );
}

function Row({
  title,
  meta,
}: {
  title: string;
  meta: (string | null | undefined)[];
}) {
  const parts = meta.filter(Boolean) as string[];

  return (
    <View className="border-b border-slate-100 pb-2">
      <Text className="text-sm font-medium text-slate-900">{title}</Text>
      {parts.length > 0 ? (
        <Text className="mt-0.5 text-xs text-slate-500">{parts.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

export default function AdminUserDetailScreen() {
  return (
    <AuthGate requireAdmin >
      <AdminUserDetailScreenInner />
    </AuthGate>
  );
}
