import { Button, Card, Field, Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Download, LogOut, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';

export default function SettingsScreen() {
  const { me, isAdmin, signOut } = useAuth();
  const { toast } = useToast();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * 내 데이터를 공유 시트로 내보낸다.
   *
   * 모바일에는 '다운로드 폴더'라는 개념이 웹과 달라, 파일로 떨구는 대신
   * 사용자가 저장 위치(메모·드라이브·메일)를 직접 고르게 한다.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/api/users/me/export');
      await Share.share({
        title: '내 AutoFill-Fit 데이터',
        message: JSON.stringify(data, null, 2),
      });
    } catch {
      toast({ variant: 'error', title: '내려받지 못했습니다' });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await api.delete('/api/users/me', { data: { password } });
      await signOut();
    } catch {
      setError('비밀번호가 올바르지 않습니다.');
      setDeleting(false);
    }
  };

  const askDelete = () => {
    Alert.alert(
      '정말 탈퇴하시겠습니까?',
      '계정과 인적사항, 이력서가 모두 삭제됩니다. 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '계속', style: 'destructive', onPress: () => setConfirming(true) },
      ],
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-5 gap-4"
    >
      <Card>
        <Text className="text-sm font-medium text-slate-500">계정</Text>

        <View className="mt-3 flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Text className="text-xs font-semibold uppercase text-slate-600">
              {me?.email?.slice(0, 2) ?? '--'}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
              {me?.email ?? ''}
            </Text>
            {isAdmin ? (
              <View className="mt-1 flex-row items-center gap-1">
                <ShieldCheck size={12} color="#0f172a" />
                <Text className="text-xs text-slate-500">관리자</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      <Card>
        <Text className="text-sm font-medium text-slate-500">연결된 서버</Text>
        <Text className="mt-2 text-sm text-slate-900">{API_BASE_URL}</Text>
        <Text className="mt-2 text-xs leading-relaxed text-slate-500">
          실기기에서 테스트할 때는 PC의 LAN IP가 필요합니다.
          {'\n'}
          .env의 EXPO_PUBLIC_API_BASE_URL을 바꾼 뒤 앱을 다시 시작하세요.
        </Text>
      </Card>

      <Card>
        <Text className="text-sm font-medium text-slate-500">내 데이터</Text>
        <Text className="mt-2 text-xs leading-relaxed text-slate-500">
          계정 정보와 인적사항, 학력·경력·자격증, 자기소개서 전문을 한 번에
          내보냅니다.
        </Text>
        <Button
          label="내보내기"
          variant="ghost"
          className="mt-3"
          loading={exporting}
          onPress={() => void handleExport()}
          icon={<Download size={16} color="#475569" />}
        />
      </Card>

      <Button
        label="로그아웃"
        variant="ghost"
        onPress={() => void signOut()}
        icon={<LogOut size={16} color="#475569" />}
      />

      {/* 탈퇴는 되돌릴 수 없으므로 맨 아래에 두고 색으로 구분한다 */}
      <Card className="border-rose-200">
        <Text className="text-sm font-medium text-slate-500">회원 탈퇴</Text>
        <Text className="mt-2 text-xs leading-relaxed text-slate-500">
          계정과 이력서가 모두 삭제되며 복구할 수 없습니다. 탈퇴 전에 위에서
          데이터를 먼저 내보내시기를 권합니다.
        </Text>

        {confirming ? (
          <View className="mt-3 gap-3">
            <Field label="비밀번호 확인" error={error ?? undefined}>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="본인 확인을 위해 입력해 주세요"
              />
            </Field>
            <Button
              label="영구 삭제"
              variant="danger"
              loading={deleting}
              disabled={password.length === 0}
              onPress={() => void handleDelete()}
              icon={<Trash2 size={16} color="#ffffff" />}
            />
            <Button
              label="취소"
              variant="ghost"
              disabled={deleting}
              onPress={() => {
                setConfirming(false);
                setPassword('');
                setError(null);
              }}
            />
          </View>
        ) : (
          <Button
            label="탈퇴하기"
            variant="ghost"
            className="mt-3 border-rose-300"
            onPress={askDelete}
            icon={<Trash2 size={16} color="#be123c" />}
          />
        )}
      </Card>
    </ScrollView>
  );
}
