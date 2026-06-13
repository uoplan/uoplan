import { Text as RNText, TextInput as RNTextInput, View } from "react-native";

import type { TextInputProps } from "./TextInput.types";

const TEXT_COLOR = "#2a2826";
const LABEL_COLOR = "#5e5a52";
const BORDER_COLOR = "#d2cdc2";
const PLACEHOLDER_COLOR = "#9aa0a6";
const SURFACE_BG = "#fffdfa";

/** Native (React Native) implementation of the TextInput contract. */
export function TextInput({
  value,
  defaultValue,
  onChangeText,
  placeholder,
  label,
  disabled,
  testID,
}: TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      {label ? <RNText style={{ color: LABEL_COLOR, fontSize: 14 }}>{label}</RNText> : null}
      <RNTextInput
        testID={testID}
        value={value}
        defaultValue={defaultValue}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        editable={!disabled}
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
