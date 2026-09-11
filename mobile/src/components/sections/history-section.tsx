import {
  AddButton,
  ChipField,
  RepeatableItem,
  SwitchField,
  TextField,
} from '@/components/form-fields';
import { Card, EmptyState } from '@/components/ui';
import {
  EMPTY_CAREER,
  EMPTY_EDUCATION,
  type ResumeFormValues,
} from '@/lib/resume-form';
import {
  EDUCATION_DEGREE_LABELS,
  EDUCATION_STATUS_LABELS,
  type EducationDegree,
  type EducationStatus,
} from '@/types/resume';
import { Briefcase, GraduationCap } from 'lucide-react-native';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Text, View } from 'react-native';

const YEAR_MONTH_RULE = {
  pattern: {
    value: /^\d{4}-(0[1-9]|1[0-2])$/,
    message: 'YYYY-MM 형식으로 입력해 주세요.',
  },
} as const;

const DEGREE_OPTIONS = (
  Object.keys(EDUCATION_DEGREE_LABELS) as EducationDegree[]
).map((value) => ({ value, label: EDUCATION_DEGREE_LABELS[value] }));

const STATUS_OPTIONS = (
  Object.keys(EDUCATION_STATUS_LABELS) as EducationStatus[]
).map((value) => ({ value, label: EDUCATION_STATUS_LABELS[value] }));

export function HistorySection() {
  return (
    <View className="gap-4">
      <EducationCard />
      <CareerCard />
    </View>
  );
}

function EducationCard() {
  const { control } = useFormContext<ResumeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'education',
  });
  const education = useWatch({ control, name: 'education' });

  return (
    <Card>
      <Text className="text-base font-semibold text-slate-900">학력</Text>
      <Text className="mb-5 mt-1 text-sm text-slate-500">
        최종 학력부터 입력하면 지원서 순서와 맞습니다.
      </Text>

      {fields.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={20} color="#94a3b8" />}
          title="등록된 학력이 없습니다"
          description="학교명과 재학 기간만 넣어도 대부분의 지원서를 채울 수 있습니다."
          action={
            <AddButton label="학력 추가" onPress={() => append(EMPTY_EDUCATION)} />
          }
        />
      ) : (
        <View className="gap-4">
          {fields.map((field, index) => (
            <RepeatableItem
              key={field.id}
              index={index}
              label="학력"
              summary={[education?.[index]?.schoolName, education?.[index]?.major]
                .filter(Boolean)
                .join(' · ')}
              onRemove={() => remove(index)}
            >
              <TextField<ResumeFormValues>
                name={`education.${index}.schoolName`}
                label="학교명"
                required
                inputProps={{ placeholder: '한국대학교' }}
              />
              <TextField<ResumeFormValues>
                name={`education.${index}.major`}
                label="전공"
                inputProps={{ placeholder: '컴퓨터공학' }}
              />
              <ChipField<ResumeFormValues>
                name={`education.${index}.degree`}
                label="학위"
                options={DEGREE_OPTIONS}
              />
              <ChipField<ResumeFormValues>
                name={`education.${index}.status`}
                label="졸업 상태"
                options={STATUS_OPTIONS}
              />
              <TextField<ResumeFormValues>
                name={`education.${index}.admissionDate`}
                label="입학 연월"
                hint="YYYY-MM"
                rules={YEAR_MONTH_RULE}
                inputProps={{
                  placeholder: '2014-03',
                  keyboardType: 'numbers-and-punctuation',
                }}
              />
              <TextField<ResumeFormValues>
                name={`education.${index}.graduationDate`}
                label="졸업 연월"
                hint="YYYY-MM"
                rules={YEAR_MONTH_RULE}
                inputProps={{
                  placeholder: '2018-02',
                  keyboardType: 'numbers-and-punctuation',
                }}
              />
              <TextField<ResumeFormValues>
                name={`education.${index}.gpa`}
                label="학점"
                rules={{
                  pattern: { value: /^\d+(\.\d+)?$/, message: '숫자로 입력해 주세요.' },
                }}
                inputProps={{ placeholder: '3.85', keyboardType: 'decimal-pad' }}
              />
              <TextField<ResumeFormValues>
                name={`education.${index}.gpaScale`}
                label="만점 기준"
                rules={{
                  pattern: { value: /^\d+(\.\d+)?$/, message: '숫자로 입력해 주세요.' },
                }}
                inputProps={{ placeholder: '4.50', keyboardType: 'decimal-pad' }}
              />
            </RepeatableItem>
          ))}

          <AddButton label="학력 추가" onPress={() => append(EMPTY_EDUCATION)} />
        </View>
      )}
    </Card>
  );
}

function CareerCard() {
  const { control } = useFormContext<ResumeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'careers',
  });
  const noCareer = useWatch({ control, name: 'noCareer' });

  return (
    <Card>
      <Text className="text-base font-semibold text-slate-900">경력</Text>
      <Text className="mb-4 mt-1 text-sm text-slate-500">
        신입이라면 비워 두어도 됩니다. 인턴 · 계약직 경험도 넣어 두면 유용합니다.
      </Text>

      {/*
        신입은 경력 20점에 구조적으로 닿지 못한다.
        선언하면 그 배점을 만점에서 빼서 완성도가 영구 미완으로 남지 않게 한다.
      */}
      <SwitchField<ResumeFormValues>
        name="noCareer"
        label="경력이 없습니다 (신입)"
      />

      {noCareer ? (
        <Text className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600">
          경력을 완성도 배점에서 제외했습니다. 나머지 항목만으로 100%에 도달할 수
          있습니다.
        </Text>
      ) : fields.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={20} color="#94a3b8" />}
          title="등록된 경력이 없습니다"
          description="신입 지원이라면 이 항목은 건너뛰어도 괜찮습니다."
          action={
            <AddButton label="경력 추가" onPress={() => append(EMPTY_CAREER)} />
          }
        />
      ) : (
        <View className="gap-4">
          {fields.map((field, index) => (
            <CareerFields
              key={field.id}
              index={index}
              onRemove={() => remove(index)}
            />
          ))}

          <AddButton label="경력 추가" onPress={() => append(EMPTY_CAREER)} />
        </View>
      )}
    </Card>
  );
}

function CareerFields({
  index,
  onRemove,
}: {
  index: number;
  onRemove: () => void;
}) {
  const { control } = useFormContext<ResumeFormValues>();
  const isCurrent = useWatch({ control, name: `careers.${index}.isCurrent` });
  const career = useWatch({ control, name: `careers.${index}` });

  return (
    <RepeatableItem
      index={index}
      label="경력"
      summary={[career?.companyName, career?.jobTitle].filter(Boolean).join(' · ')}
      onRemove={onRemove}
    >
      <TextField<ResumeFormValues>
        name={`careers.${index}.companyName`}
        label="회사명"
        required
        inputProps={{ placeholder: '로지소프트' }}
      />
      <TextField<ResumeFormValues>
        name={`careers.${index}.department`}
        label="부서"
        inputProps={{ placeholder: '플랫폼팀' }}
      />
      <TextField<ResumeFormValues>
        name={`careers.${index}.jobTitle`}
        label="직무"
        inputProps={{ placeholder: '백엔드 개발' }}
      />
      <TextField<ResumeFormValues>
        name={`careers.${index}.position`}
        label="직급"
        inputProps={{ placeholder: '주임' }}
      />
      <TextField<ResumeFormValues>
        name={`careers.${index}.joinDate`}
        label="입사 연월"
        hint="YYYY-MM"
        rules={YEAR_MONTH_RULE}
        inputProps={{
          placeholder: '2020-01',
          keyboardType: 'numbers-and-punctuation',
        }}
      />

      <SwitchField<ResumeFormValues>
        name={`careers.${index}.isCurrent`}
        label="현재 재직 중입니다"
      />

      {/* 재직 중이면 퇴사 연월 자체를 감춘다 — 비활성 입력보다 명확하다. */}
      {!isCurrent ? (
        <TextField<ResumeFormValues>
          name={`careers.${index}.leaveDate`}
          label="퇴사 연월"
          hint="YYYY-MM"
          rules={YEAR_MONTH_RULE}
          inputProps={{
            placeholder: '2023-12',
            keyboardType: 'numbers-and-punctuation',
          }}
        />
      ) : null}

      <TextField<ResumeFormValues>
        name={`careers.${index}.mainTasks`}
        label="주요 업무"
        inputProps={{
          placeholder: '결제 API 설계 및 개발, 정산 배치 운영',
          multiline: true,
          numberOfLines: 3,
          style: { minHeight: 80, textAlignVertical: 'top' },
        }}
      />
    </RepeatableItem>
  );
}
