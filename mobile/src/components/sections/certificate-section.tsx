import { AddButton, RepeatableItem, TextField } from '@/components/form-fields';
import { Card, EmptyState } from '@/components/ui';
import { EMPTY_CERTIFICATE, type ResumeFormValues } from '@/lib/resume-form';
import { Award } from 'lucide-react-native';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Text, View } from 'react-native';

export function CertificateSection() {
  const { control } = useFormContext<ResumeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'certificates',
  });
  const certificates = useWatch({ control, name: 'certificates' });

  return (
    <Card>
      <Text className="text-base font-semibold text-slate-900">자격증</Text>
      <Text className="mb-5 mt-1 text-sm text-slate-500">
        어학 점수도 함께 등록해 두면 지원서의 어학 칸까지 채울 수 있습니다.
      </Text>

      {fields.length === 0 ? (
        <EmptyState
          icon={<Award size={20} color="#94a3b8" />}
          title="등록된 자격증이 없습니다"
          description="정보처리기사, TOEIC처럼 자주 쓰는 항목을 먼저 넣어 두세요."
          action={
            <AddButton
              label="자격증 추가"
              onPress={() => append(EMPTY_CERTIFICATE)}
            />
          }
        />
      ) : (
        <View className="gap-4">
          {fields.map((field, index) => (
            <RepeatableItem
              key={field.id}
              index={index}
              label="자격증"
              summary={[
                certificates?.[index]?.name,
                certificates?.[index]?.issuer,
              ]
                .filter(Boolean)
                .join(' · ')}
              onRemove={() => remove(index)}
            >
              <TextField<ResumeFormValues>
                name={`certificates.${index}.name`}
                label="자격증명"
                required
                inputProps={{ placeholder: '정보처리기사' }}
              />
              <TextField<ResumeFormValues>
                name={`certificates.${index}.issuer`}
                label="발급기관"
                inputProps={{ placeholder: '한국산업인력공단' }}
              />
              <TextField<ResumeFormValues>
                name={`certificates.${index}.acquiredAt`}
                label="취득일"
                hint="YYYY-MM-DD"
                rules={{
                  pattern: {
                    value: /^\d{4}-\d{2}-\d{2}$/,
                    message: 'YYYY-MM-DD 형식으로 입력해 주세요.',
                  },
                }}
                inputProps={{
                  placeholder: '2019-08-16',
                  keyboardType: 'numbers-and-punctuation',
                }}
              />
              <TextField<ResumeFormValues>
                name={`certificates.${index}.score`}
                label="점수 / 등급"
                hint="어학 시험일 때만 입력합니다."
                inputProps={{ placeholder: 'TOEIC 925 / 1급' }}
              />
            </RepeatableItem>
          ))}

          <AddButton
            label="자격증 추가"
            onPress={() => append(EMPTY_CERTIFICATE)}
          />
        </View>
      )}
    </Card>
  );
}
