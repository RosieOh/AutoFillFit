import {
  AddButton,
  ChipField,
  RepeatableItem,
  TextField,
} from '@/components/form-fields';
import { Card, EmptyState, Field, Input } from '@/components/ui';
import { EMPTY_ESSAY, type ResumeFormValues } from '@/lib/resume-form';
import { ESSAY_TYPE_LABELS, type EssayType } from '@/types/resume';
import { FileText, Star } from 'lucide-react-native';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

const TYPE_OPTIONS = (Object.keys(ESSAY_TYPE_LABELS) as EssayType[]).map(
  (value) => ({ value, label: ESSAY_TYPE_LABELS[value] }),
);

export function EssaySection() {
  const { control } = useFormContext<ResumeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'essays',
  });

  return (
    <Card>
      <Text className="text-base font-semibold text-slate-900">
        마스터 자소서
      </Text>
      <Text className="mb-5 mt-1 text-sm text-slate-500">
        자주 나오는 문항의 답변을 저장해 두면, 확장 프로그램이 문항을 찾아 채워
        넣습니다.
      </Text>

      {fields.length === 0 ? (
        <EmptyState
          icon={<FileText size={20} color="#94a3b8" />}
          title="등록된 문항이 없습니다"
          description="지원동기처럼 어느 회사에나 나오는 문항부터 채워 두면 가장 많이 쓰입니다."
          action={<AddButton label="문항 추가" onPress={() => append(EMPTY_ESSAY)} />}
        />
      ) : (
        <View className="gap-4">
          {fields.map((field, index) => (
            <EssayFields
              key={field.id}
              index={index}
              total={fields.length}
              onRemove={() => remove(index)}
            />
          ))}

          <AddButton label="문항 추가" onPress={() => append(EMPTY_ESSAY)} />
        </View>
      )}
    </Card>
  );
}

function EssayFields({
  index,
  total,
  onRemove,
}: {
  index: number;
  total: number;
  onRemove: () => void;
}) {
  const { control, setValue } = useFormContext<ResumeFormValues>();

  const content = useWatch({ control, name: `essays.${index}.content` }) ?? '';
  const charLimitRaw =
    useWatch({ control, name: `essays.${index}.charLimit` }) ?? '';
  const isDefault = useWatch({ control, name: `essays.${index}.isDefault` });

  const charLimit = Number.parseInt(charLimitRaw, 10);
  const hasLimit = Number.isFinite(charLimit) && charLimit > 0;
  const overLimit = hasLimit && content.length > charLimit;

  /** 기본 답변은 하나만 유지한다 — 확장 프로그램이 단일 fallback을 쓰기 때문. */
  const selectAsDefault = () => {
    for (let i = 0; i < total; i += 1) {
      setValue(`essays.${i}.isDefault`, i === index, { shouldDirty: true });
    }
  };

  const title = useWatch({ control, name: `essays.${index}.title` });

  return (
    <RepeatableItem
      index={index}
      label="문항"
      summary={title}
      onRemove={onRemove}
    >
      <TextField<ResumeFormValues>
        name={`essays.${index}.title`}
        label="문항 제목"
        required
        rules={{ maxLength: { value: 500, message: '500자 이내로 입력해 주세요.' } }}
        inputProps={{ placeholder: '지원 동기를 작성해 주세요.' }}
      />

      <ChipField<ResumeFormValues>
        name={`essays.${index}.type`}
        label="문항 유형"
        options={TYPE_OPTIONS}
      />

      <TextField<ResumeFormValues>
        name={`essays.${index}.charLimit`}
        label="글자수 제한"
        hint="비워 두면 제한 없이 저장합니다."
        rules={{ pattern: { value: /^\d+$/, message: '숫자만 입력해 주세요.' } }}
        inputProps={{ placeholder: '1000', keyboardType: 'number-pad' }}
      />

      <TextField<ResumeFormValues>
        name={`essays.${index}.keywords`}
        label="매칭 키워드"
        hint="쉼표로 구분합니다. 지원서 문항에 이 말이 있으면 이 답변을 넣습니다."
        inputProps={{ placeholder: '지원동기, 지원 이유, 왜 우리 회사' }}
      />

      <Controller
        control={control}
        name={`essays.${index}.content`}
        render={({ field: { onChange, onBlur, value } }) => (
          <View className="mb-4">
            <View className="mb-1.5 flex-row items-end justify-between">
              <Text className="text-sm font-medium text-slate-700">
                답변 내용<Text className="text-blue-600"> *</Text>
              </Text>
              <Text
                className={`text-xs ${
                  overLimit ? 'font-medium text-rose-600' : 'text-slate-500'
                }`}
              >
                {content.length.toLocaleString()}
                {hasLimit ? ` / ${charLimit.toLocaleString()}자` : '자'}
              </Text>
            </View>

            <Input
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              invalid={overLimit}
              multiline
              numberOfLines={6}
              placeholder="문제를 정의하고 해결한 경험을 중심으로 작성해 주세요."
              style={{ minHeight: 140, textAlignVertical: 'top' }}
            />

            {overLimit ? (
              <Text className="mt-1.5 text-xs text-rose-600">
                제한보다 {(content.length - charLimit).toLocaleString()}자 깁니다.
                저장은 되지만 지원서에서 잘릴 수 있습니다.
              </Text>
            ) : null}
          </View>
        )}
      />

      <Pressable
        onPress={selectAsDefault}
        accessibilityRole="radio"
        accessibilityState={{ selected: Boolean(isDefault) }}
        className="flex-row items-center gap-2.5"
      >
        <View
          className={`h-5 w-5 items-center justify-center rounded-full border ${
            isDefault ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
          }`}
        >
          {isDefault ? <Star size={11} color="#ffffff" fill="#ffffff" /> : null}
        </View>
        <Text className="flex-1 text-sm text-slate-700">
          문항을 찾지 못했을 때 이 답변을 사용
        </Text>
      </Pressable>
    </RepeatableItem>
  );
}
