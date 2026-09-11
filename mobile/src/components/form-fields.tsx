import { ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useFormContext, type FieldValues, type Path, type RegisterOptions } from 'react-hook-form';
import { Pressable, Text, View, type TextInputProps } from 'react-native';
import { Field, Input } from './ui';

interface TextFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  hint?: string;
  required?: boolean;
  rules?: RegisterOptions<T, Path<T>>;
  inputProps?: TextInputProps;
}

/** RHF Controller + Field + Input을 한 덩어리로 묶는다. */
export function TextField<T extends FieldValues>({
  name,
  label,
  hint,
  required,
  rules,
  inputProps,
}: TextFieldProps<T>) {
  const { control } = useFormContext<T>();

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <Field label={label} hint={hint} required={required} error={error?.message}>
          <Input
            value={(value ?? '') as string}
            onChangeText={onChange}
            onBlur={onBlur}
            invalid={Boolean(error)}
            {...inputProps}
          />
        </Field>
      )}
    />
  );
}

/** 값이 정해진 선택지는 모바일에서 드롭다운보다 칩이 빠르다. */
export function ChipField<T extends FieldValues>({
  name,
  label,
  options,
}: {
  name: Path<T>;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { control } = useFormContext<T>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <Field label={label}>
          <View className="flex-row flex-wrap gap-2">
            {options.map((option) => {
              const selected = value === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => onChange(selected ? '' : option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`min-h-11 justify-center rounded-full border px-3.5 ${
                    selected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      selected ? 'text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({
  name,
  label,
}: {
  name: Path<T>;
  label: string;
}) {
  const { control } = useFormContext<T>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <Pressable
          onPress={() => onChange(!value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: Boolean(value) }}
          className="mb-4 min-h-11 flex-row items-center gap-2.5"
        >
          <View
            className={`h-5 w-5 items-center justify-center rounded border ${
              value ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
            }`}
          >
            {value ? (
              <Text className="text-[11px] font-bold text-white">✓</Text>
            ) : null}
          </View>
          <Text className="text-sm text-slate-700">{label}</Text>
        </Pressable>
      )}
    />
  );
}

/**
 * 반복 항목 한 건의 껍데기.
 * 좁은 화면에서 항목이 늘면 스크롤 지옥이 되므로 작성된 항목은 접어 둔다.
 */
export function RepeatableItem({
  index,
  label,
  summary,
  onRemove,
  children,
}: {
  index: number;
  label: string;
  /** 접었을 때 보여줄 한 줄 요약 — 비어 있으면 새 항목으로 보고 펼친다. */
  summary?: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!summary);

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Pressable
          onPress={() => setOpen((current) => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2"
        >
          <ChevronDown
            size={16}
            color="#64748b"
            style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }}
          />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label} {index + 1}
          </Text>
          {!open && summary ? (
            <Text className="min-w-0 flex-1 text-xs text-slate-600" numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={onRemove}
          className="min-h-11 flex-row items-center gap-1.5 rounded-md px-2"
        >
          <Trash2 size={14} color="#64748b" />
          <Text className="text-xs font-medium text-slate-500">삭제</Text>
        </Pressable>
      </View>

      {open ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}

export function AddButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Plus size={16} color="#475569" />
      <Text className="text-sm font-medium text-slate-700">{label}</Text>
    </Pressable>
  );
}
