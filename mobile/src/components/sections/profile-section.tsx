import { TextField } from '@/components/form-fields';
import { Card } from '@/components/ui';
import type { ResumeFormValues } from '@/lib/resume-form';
import { Text } from 'react-native';

export function ProfileSection() {
  return (
    <Card>
      <Text className="text-base font-semibold text-slate-900">
        기본 인적사항
      </Text>
      <Text className="mb-5 mt-1 text-sm text-slate-500">
        지원서의 이름 · 연락처 · 주소 칸에 그대로 채워지는 값입니다.
      </Text>

      <TextField<ResumeFormValues>
        name="profile.name"
        label="이름"
        required
        rules={{ maxLength: { value: 60, message: '60자 이내로 입력해 주세요.' } }}
        inputProps={{ placeholder: '홍길동', autoComplete: 'name' }}
      />

      <TextField<ResumeFormValues>
        name="profile.phone"
        label="연락처"
        hint="하이픈은 자동으로 제거되어 저장됩니다."
        rules={{
          pattern: {
            value: /^[0-9-+()\s]{9,20}$/,
            message: '숫자와 하이픈으로 9~20자를 입력해 주세요.',
          },
        }}
        inputProps={{
          placeholder: '010-1234-5678',
          keyboardType: 'phone-pad',
          autoComplete: 'tel',
        }}
      />

      <TextField<ResumeFormValues>
        name="profile.birthdate"
        label="생년월일"
        hint="YYYY-MM-DD"
        rules={{
          pattern: {
            value: /^\d{4}-\d{2}-\d{2}$/,
            message: 'YYYY-MM-DD 형식으로 입력해 주세요.',
          },
        }}
        inputProps={{ placeholder: '1995-03-02', keyboardType: 'numbers-and-punctuation' }}
      />

      <TextField<ResumeFormValues>
        name="profile.zipCode"
        label="우편번호"
        hint="5자리 숫자"
        rules={{
          pattern: {
            value: /^\d{5}$|^\d{3}-\d{3}$/,
            message: '5자리 우편번호를 입력해 주세요.',
          },
        }}
        inputProps={{
          placeholder: '06236',
          keyboardType: 'number-pad',
          autoComplete: 'postal-code',
        }}
      />

      <TextField<ResumeFormValues>
        name="profile.address"
        label="주소"
        rules={{ maxLength: { value: 255, message: '255자 이내로 입력해 주세요.' } }}
        inputProps={{
          placeholder: '서울시 강남구 테헤란로 123, 4층',
          autoComplete: 'street-address',
        }}
      />
    </Card>
  );
}
