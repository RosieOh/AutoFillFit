'use client';

import { Field, Input } from '@/components/ui/field';
import { EMPTY_CERTIFICATE, type ResumeFormValues } from '@/lib/resume-form';
import { Award } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  AddButton,
  EmptyState,
  FieldGrid,
  RepeatableItem,
  SectionCard,
} from '../section-shell';

export function CertificateSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'certificates',
  });
  const certificates = useWatch({ control, name: 'certificates' });

  return (
    <SectionCard
      title="자격증"
      description="어학 점수도 함께 등록해 두면 지원서의 어학 칸까지 채울 수 있습니다."
      action={
        fields.length > 0 ? (
          <AddButton onClick={() => append(EMPTY_CERTIFICATE)}>
            자격증 추가
          </AddButton>
        ) : undefined
      }
    >
      {fields.length === 0 ? (
        <EmptyState
          icon={Award}
          title="등록된 자격증이 없습니다"
          description="정보처리기사, TOEIC처럼 지원서에 자주 쓰는 항목을 먼저 넣어 두세요."
          action={
            <AddButton onClick={() => append(EMPTY_CERTIFICATE)}>
              자격증 추가
            </AddButton>
          }
        />
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => {
            const itemErrors = errors.certificates?.[index];

            return (
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
                <FieldGrid>
                  <Field
                    label="자격증명"
                    required
                    error={itemErrors?.name?.message}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        placeholder="정보처리기사"
                        {...register(`certificates.${index}.name`, {
                          maxLength: {
                            value: 120,
                            message: '120자 이내로 입력해 주세요.',
                          },
                        })}
                      />
                    )}
                  </Field>

                  <Field label="발급기관">
                    {({ id }) => (
                      <Input
                        id={id}
                        placeholder="한국산업인력공단"
                        {...register(`certificates.${index}.issuer`)}
                      />
                    )}
                  </Field>

                  <Field label="취득일">
                    {({ id }) => (
                      <Input
                        id={id}
                        type="date"
                        max="9999-12-31"
                        {...register(`certificates.${index}.acquiredAt`)}
                      />
                    )}
                  </Field>

                  <Field label="점수 / 등급" hint="어학 시험일 때만 입력합니다.">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        placeholder="TOEIC 925 / 1급"
                        className="tabular"
                        {...register(`certificates.${index}.score`)}
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
