'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EMPTY_ESSAY, type ResumeFormValues } from '@/lib/resume-form';
import { ESSAY_TYPE_LABELS, type EssayType } from '@/types/resume';
import { FileText, Star } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  AddButton,
  EmptyState,
  FieldGrid,
  RepeatableItem,
  SectionCard,
} from '../section-shell';

export function EssaySection() {
  const { control } = useFormContext<ResumeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'essays',
  });

  return (
    <SectionCard
      title="마스터 자소서"
      description="자주 나오는 문항의 답변을 저장해 두면, 확장 프로그램이 문항을 찾아 채워 넣습니다."
      action={
        fields.length > 0 ? (
          <AddButton onClick={() => append(EMPTY_ESSAY)}>문항 추가</AddButton>
        ) : undefined
      }
    >
      {fields.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="등록된 문항이 없습니다"
          description="지원동기처럼 어느 회사에나 나오는 문항부터 채워 두면 가장 많이 쓰입니다."
          action={
            <AddButton onClick={() => append(EMPTY_ESSAY)}>문항 추가</AddButton>
          }
        />
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <EssayItemFields
              key={field.id}
              index={index}
              total={fields.length}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function EssayItemFields({
  index,
  total,
  onRemove,
}: {
  index: number;
  total: number;
  onRemove: () => void;
}) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<ResumeFormValues>();

  const content = useWatch({ control, name: `essays.${index}.content` }) ?? '';
  const charLimitRaw =
    useWatch({ control, name: `essays.${index}.charLimit` }) ?? '';
  const isDefault = useWatch({ control, name: `essays.${index}.isDefault` });

  const charLimit = Number.parseInt(charLimitRaw, 10);
  const hasLimit = Number.isFinite(charLimit) && charLimit > 0;
  const overLimit = hasLimit && content.length > charLimit;
  const itemErrors = errors.essays?.[index];

  /** 기본 답변은 하나만 유지한다 — 확장 프로그램이 단일 fallback을 쓰기 때문. */
  const handleDefaultChange = (checked: boolean) => {
    if (!checked) return;
    for (let i = 0; i < total; i += 1) {
      if (i !== index) {
        setValue(`essays.${i}.isDefault`, false, { shouldDirty: true });
      }
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
      <FieldGrid>
        <Field
          label="문항 제목"
          required
          wide
          error={itemErrors?.title?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="지원 동기를 작성해 주세요."
              {...register(`essays.${index}.title`, {
                maxLength: {
                  value: 500,
                  message: '500자 이내로 입력해 주세요.',
                },
              })}
            />
          )}
        </Field>

        <Field label="문항 유형" hint="같은 유형의 문항을 찾을 때 쓰입니다.">
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              {...register(`essays.${index}.type`)}
            >
              <option value="">선택 안 함</option>
              {(Object.keys(ESSAY_TYPE_LABELS) as EssayType[]).map((key) => (
                <option key={key} value={key}>
                  {ESSAY_TYPE_LABELS[key]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="글자수 제한"
          hint="비워 두면 제한 없이 저장합니다."
          error={itemErrors?.charLimit?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="numeric"
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="1000"
              className="tabular"
              {...register(`essays.${index}.charLimit`, {
                pattern: {
                  value: /^\d+$/,
                  message: '숫자만 입력해 주세요.',
                },
              })}
            />
          )}
        </Field>

        <Field
          label="매칭 키워드"
          wide
          hint="쉼표로 구분합니다. 지원서 문항에 이 말이 있으면 이 답변을 넣습니다."
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              placeholder="지원동기, 지원 이유, 왜 우리 회사"
              {...register(`essays.${index}.keywords`)}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-end justify-between gap-3">
            <label
              htmlFor={`essay-content-${index}`}
              className="text-sm font-medium text-slate-700"
            >
              답변 내용
              <span className="ml-1 text-blue-600" aria-hidden="true">
                *
              </span>
            </label>
            <span
              className={`tabular text-xs ${
                overLimit ? 'font-medium text-rose-600' : 'text-slate-500'
              }`}
            >
              {content.length.toLocaleString()}
              {hasLimit ? ` / ${charLimit.toLocaleString()}자` : '자'}
            </span>
          </div>

          <Textarea
            id={`essay-content-${index}`}
            rows={6}
            invalid={overLimit}
            placeholder="문제를 정의하고 해결한 경험을 중심으로 작성해 주세요."
            {...register(`essays.${index}.content`)}
          />

          {overLimit ? (
            <p className="mt-1.5 text-xs text-rose-600">
              제한보다 {(content.length - charLimit).toLocaleString()}자 깁니다.
              저장은 되지만 지원서에서 잘릴 수 있습니다.
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-blue-600 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/60"
              {...register(`essays.${index}.isDefault`, {
                onChange: (event) => handleDefaultChange(event.target.checked),
              })}
            />
            <span className="inline-flex items-center gap-1.5">
              {isDefault ? (
                <Star
                  className="h-3.5 w-3.5 fill-blue-600 text-blue-600"
                  aria-hidden="true"
                />
              ) : null}
              문항을 찾지 못했을 때 이 답변을 사용
            </span>
          </label>
        </div>
      </FieldGrid>
    </RepeatableItem>
  );
}
