import { useState } from "react";
import { Text as RNText, TextInput as RNTextInput, View } from "react-native";

import type { NumberInputProps } from "./NumberInput.types";

const TEXT_COLOR = "#2a2826";
const LABEL_COLOR = "#5e5a52";
const BORDER_COLOR = "#d2cdc2";
const PLACEHOLDER_COLOR = "#9aa0a6";
const SURFACE_BG = "#fffdfa";

/** Clamp a parsed number into the optional [min, max] range. */
function clampNumber(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
}

/** Native (React Native) implementation of the NumberInput contract. */
export function NumberInput({
  value,
  defaultValue,
  onChange,
  min,
  max,
  label,
  placeholder,
  disabled,
  testID,
}: NumberInputProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(
    defaultValue === undefined ? "" : String(defaultValue),
  );
  const text = isControlled ? (value === undefined ? "" : String(value)) : internal;

  const handleChange = (raw: string) => {
    if (!isControlled) setInternal(raw);
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange?.();
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return;
    onChange?.(clampNumber(parsed, min, max));
  };

  return (
    <View style={{ gap: 4 }}>
      {label ? <RNText style={{ color: LABEL_COLOR, fontSize: 14 }}>{label}</RNText> : null}
      <RNTextInput
        testID={testID}
        value={text}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        editable={!disabled}
        keyboardType="numeric"
        style={{
          backgroundColor: SURFACE_BG,
          color: TEXT_COLOR,
          borderWidth: 1,
          borderColor: BORDER_COLOR,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </View>
  );
}
