'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/field';
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
import { Briefcase, GraduationCap } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  AddButton,
  EmptyState,
  FieldGrid,
  RepeatableItem,
  SectionCard,
} from '../section-shell';

const YEAR_MONTH_RULE = {
  pattern: {
    value: /^\d{4}-(0[1-9]|1[0-2])$/,
    message: 'YYYY-MM 형식으로 입력해 주세요.',
  },
} as const;

export function HistorySection() {
  return (
    <div className="space-y-6">
      <EducationCard />
      <CareerCard />
    </div>
  );
}

function EducationCard() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'education',
  });
  const education = useWatch({ control, name: 'education' });

  return (
    <SectionCard
      title="학력"
      description="최종 학력부터 입력하면 지원서 순서와 맞습니다."
      action={
        fields.length > 0 ? (
          <AddButton onClick={() => append(EMPTY_EDUCATION)}>
            학력 추가
          </AddButton>
        ) : undefined
      }
    >
      {fields.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="등록된 학력이 없습니다"
          description="학교명과 재학 기간만 넣어도 대부분의 지원서를 채울 수 있습니다."
          action={
            <AddButton onClick={() => append(EMPTY_EDUCATION)}>
              학력 추가
            </AddButton>
          }
        />
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => {
            const itemErrors = errors.education?.[index];

            return (
              <RepeatableItem
                key={field.id}
                index={index}
                label="학력"
                summary={[
                  education?.[index]?.schoolName,
                  education?.[index]?.major,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onRemove={() => remove(index)}
              >
                <FieldGrid>
                  <Field
                    label="학교명"
                    required
                    error={itemErrors?.schoolName?.message}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        placeholder="한국대학교"
                        {...register(`education.${index}.schoolName`, {
                          maxLength: {
                            value: 120,
                            message: '120자 이내로 입력해 주세요.',
                          },
                        })}
                      />
                    )}
                  </Field>

                  <Field label="전공" error={itemErrors?.major?.message}>
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        placeholder="컴퓨터공학"
                        {...register(`education.${index}.major`)}
                      />
                    )}
                  </Field>

                  <Field label="학위">
                    {({ id }) => (
                      <Select id={id} {...register(`education.${index}.degree`)}>
                        <option value="">선택 안 함</option>
                        {(
                          Object.keys(
                            EDUCATION_DEGREE_LABELS,
                          ) as EducationDegree[]
                        ).map((key) => (
                          <option key={key} value={key}>
                            {EDUCATION_DEGREE_LABELS[key]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  <Field label="졸업 상태">
                    {({ id }) => (
                      <Select id={id} {...register(`education.${index}.status`)}>
                        <option value="">선택 안 함</option>
                        {(
                          Object.keys(
                            EDUCATION_STATUS_LABELS,
                          ) as EducationStatus[]
                        ).map((key) => (
                          <option key={key} value={key}>
                            {EDUCATION_STATUS_LABELS[key]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  <Field
                    label="입학 연월"
                    hint="YYYY-MM"
                    error={itemErrors?.admissionDate?.message}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        placeholder="2014-03"
                        className="tabular"
                        {...register(
                          `education.${index}.admissionDate`,
                          YEAR_MONTH_RULE,
                        )}
                      />
                    )}
                  </Field>

                  <Field
                    label="졸업 연월"
                    hint="YYYY-MM"
                    error={itemErrors?.graduationDate?.message}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        placeholder="2018-02"
                        className="tabular"
                        {...register(
                          `education.${index}.graduationDate`,
                          YEAR_MONTH_RULE,
                        )}
                      />
                    )}
                  </Field>

                  <Field label="학점" error={itemErrors?.gpa?.message}>
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        aria-describedby={describedBy}
                        invalid={invalid}
                        placeholder="3.85"
                        className="tabular"
                        {...register(`education.${index}.gpa`, {
                          pattern: {
                            value: /^\d+(\.\d+)?$/,
                            message: '숫자로 입력해 주세요.',
                          },
                        })}
                      />
                    )}
                  </Field>

                  <Field label="만점 기준" error={itemErrors?.gpaScale?.message}>
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        aria-describedby={describedBy}
                        invalid={invalid}
                        placeholder="4.50"
                        className="tabular"
                        {...register(`education.${index}.gpaScale`, {
                          pattern: {
                            value: /^\d+(\.\d+)?$/,
                            message: '숫자로 입력해 주세요.',
                          },
                        })}
                      />
                    )}
                  </Field>
                </FieldGrid>
              </RepeatableItem>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function CareerCard() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'careers',
  });
  const noCareer = useWatch({ control, name: 'noCareer' });

  return (
    <SectionCard
      title="경력"
      description="신입이라면 비워 두어도 됩니다. 인턴 · 계약직 경험도 함께 넣어 두면 유용합니다."
      action={
        fields.length > 0 && !noCareer ? (
          <AddButton onClick={() => append(EMPTY_CAREER)}>경력 추가</AddButton>
        ) : undefined
      }
    >
      {/*
        신입은 경력 20점에 구조적으로 닿지 못한다.
        선언하면 그 배점을 만점에서 빼서 완성도가 영구 미완으로 남지 않게 한다.
      */}
      <label className="mb-5 flex w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 text-blue-600 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/60"
          {...register('noCareer')}
        />
        경력이 없습니다 (신입)
      </label>

      {noCareer ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600">
          경력을 완성도 배점에서 제외했습니다. 나머지 항목만으로 100%에 도달할 수
          있습니다.
        </p>
      ) : fields.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="등록된 경력이 없습니다"
          description="신입 지원이라면 이 항목은 건너뛰어도 괜찮습니다."
          action={
            <AddButton onClick={() => append(EMPTY_CAREER)}>
              경력 추가
            </AddButton>
          }
        />
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <CareerItemFields
              key={field.id}
              index={index}
              onRemove={() => remove(index)}
              register={register}
              errors={errors}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function CareerItemFields({
  index,
  onRemove,
  register,
  errors,
}: {
  index: number;
  onRemove: () => void;
  register: ReturnType<typeof useFormContext<ResumeFormValues>>['register'];
  errors: ReturnType<
    typeof useFormContext<ResumeFormValues>
  >['formState']['errors'];
}) {
  const { control } = useFormContext<ResumeFormValues>();

  // 재직 중이면 퇴사 연월 입력을 잠근다.
  const isCurrent = useWatch({ control, name: `careers.${index}.isCurrent` });
  const career = useWatch({ control, name: `careers.${index}` });
  const itemErrors = errors.careers?.[index];

  return (
    <RepeatableItem
      index={index}
      label="경력"
      summary={[career?.companyName, career?.jobTitle]
        .filter(Boolean)
        .join(' · ')}
      onRemove={onRemove}
    >
      <FieldGrid>
        <Field
          label="회사명"
          required
          error={itemErrors?.companyName?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="로지소프트"
              autoComplete="organization"
              {...register(`careers.${index}.companyName`, {
                maxLength: {
                  value: 120,
                  message: '120자 이내로 입력해 주세요.',
                },
              })}
            />
          )}
        </Field>

        <Field label="부서">
          {({ id }) => (
            <Input
              id={id}
              placeholder="플랫폼팀"
              {...register(`careers.${index}.department`)}
            />
          )}
        </Field>

        <Field label="직무">
          {({ id }) => (
            <Input
              id={id}
              placeholder="백엔드 개발"
              {...register(`careers.${index}.jobTitle`)}
            />
          )}
        </Field>

        <Field label="직급">
          {({ id }) => (
            <Input
              id={id}
              placeholder="주임"
              {...register(`careers.${index}.position`)}
            />
          )}
        </Field>

        <Field
          label="입사 연월"
          hint="YYYY-MM"
          error={itemErrors?.joinDate?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="2020-01"
              className="tabular"
              {...register(`careers.${index}.joinDate`, YEAR_MONTH_RULE)}
            />
          )}
        </Field>

        <Field
          label="퇴사 연월"
          hint={isCurrent ? '재직 중에는 입력하지 않습니다.' : 'YYYY-MM'}
          error={itemErrors?.leaveDate?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={isCurrent}
              placeholder="2023-12"
              className="tabular"
              {...register(`careers.${index}.leaveDate`, YEAR_MONTH_RULE)}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-blue-600 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/60"
              {...register(`careers.${index}.isCurrent`)}
            />
            현재 재직 중입니다
          </label>
        </div>

        <Field label="주요 업무" wide>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              placeholder="결제 API 설계 및 개발, 정산 배치 운영"
              {...register(`careers.${index}.mainTasks`)}
            />
          )}
        </Field>
      </FieldGrid>
    </RepeatableItem>
  );
}
