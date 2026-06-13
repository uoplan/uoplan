import { useState } from "react";
import { Switch as RNSwitch, Text as RNText, View } from "react-native";

import type { SwitchProps } from "./Switch.types";

const ACCENT = "#3673cb";
const LABEL_COLOR = "#2a2826";

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
        trackColor={{ true: ACCENT, false: "#d2cdc2" }}
      />
      {label ? <RNText style={{ color: LABEL_COLOR, fontSize: 14 }}>{label}</RNText> : null}
    </View>
  );
}
