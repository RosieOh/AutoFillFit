'use client';

import { Field, Input } from '@/components/ui/field';
import type { ResumeFormValues } from '@/lib/resume-form';
import { useFormContext } from 'react-hook-form';
import { FieldGrid, SectionCard } from '../section-shell';

export function ProfileSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ResumeFormValues>();

  const profileErrors = errors.profile;

  return (
    <SectionCard
      title="기본 인적사항"
      description="지원서의 이름 · 연락처 · 주소 칸에 그대로 채워지는 값입니다."
    >
      <FieldGrid>
        <Field label="이름" required error={profileErrors?.name?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="홍길동"
              autoComplete="name"
              {...register('profile.name', {
                maxLength: { value: 60, message: '60자 이내로 입력해 주세요.' },
              })}
            />
          )}
        </Field>

        <Field
          label="연락처"
          hint="하이픈은 자동으로 제거되어 저장됩니다."
          error={profileErrors?.phone?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="010-1234-5678"
              autoComplete="tel"
              {...register('profile.phone', {
                pattern: {
                  value: /^[0-9-+()\s]{9,20}$/,
                  message: '숫자와 하이픈으로 9~20자를 입력해 주세요.',
                },
              })}
            />
          )}
        </Field>

        <Field label="생년월일" error={profileErrors?.birthdate?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="date"
              aria-describedby={describedBy}
              invalid={invalid}
              max="9999-12-31"
              {...register('profile.birthdate')}
            />
          )}
        </Field>

        <Field
          label="우편번호"
          hint="5자리 숫자"
          error={profileErrors?.zipCode?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="numeric"
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="06236"
              autoComplete="postal-code"
              {...register('profile.zipCode', {
                pattern: {
                  value: /^\d{5}$|^\d{3}-\d{3}$/,
                  message: '5자리 우편번호를 입력해 주세요.',
                },
              })}
            />
          )}
        </Field>

        <Field label="주소" wide error={profileErrors?.address?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="서울시 강남구 테헤란로 123, 4층"
              autoComplete="street-address"
              {...register('profile.address', {
                maxLength: {
                  value: 255,
                  message: '255자 이내로 입력해 주세요.',
                },
              })}
            />
          )}
        </Field>
      </FieldGrid>
    </SectionCard>
  );
}
