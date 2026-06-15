import { useState } from "react";
import { Pressable, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { CheckboxProps } from "./Checkbox.types";

const ACCENT = NativeColors.accent;
const BORDER_COLOR = NativeColors.borderStrong;
const LABEL_COLOR = NativeColors.text;

/** Native (React Native) implementation of the Checkbox contract. */
export function Checkbox({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled,
  testID,
}: CheckboxProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !value;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <Pressable
      testID={testID}
      onPress={toggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: value ? 0 : 1,
          borderColor: BORDER_COLOR,
          backgroundColor: value ? ACCENT : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value ? (
          <RNText style={{ color: NativeColors.onAccent, fontSize: 13, fontWeight: "700" }}>
            ✓
          </RNText>
        ) : null}
      </View>
      {label ? <RNText style={{ color: LABEL_COLOR, fontSize: 14 }}>{label}</RNText> : null}
    </Pressable>
  );
}
