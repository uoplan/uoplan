import { useState } from "react";
import { Switch as RNSwitch, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { SwitchProps } from "./Switch.types";

const ACCENT = NativeColors.accent;
const LABEL_COLOR = NativeColors.text;
/** Switches use a white thumb in every scheme (matches the iOS/Android default);
 *  without an explicit thumbColor, Android renders a stray teal/green thumb. */
const THUMB = "#ffffff";

/** Native (React Native) implementation of the Switch contract. */
export function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled,
  testID,
}: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internal;

  const handleChange = (next: boolean) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <RNSwitch
        testID={testID}
        value={value}
        onValueChange={handleChange}
        disabled={disabled}
        trackColor={{ true: ACCENT, false: NativeColors.borderStrong }}
        thumbColor={THUMB}
        ios_backgroundColor={NativeColors.borderStrong}
      />
      {label ? (
        <RNText style={{ color: LABEL_COLOR, fontFamily: "DM Mono", fontSize: 14 }}>{label}</RNText>
      ) : null}
    </View>
  );
}
