import { Pressable, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { SegmentedControlProps } from "./SegmentedControl.types";

const TRACK_BG = NativeColors.surfaceSunken;
const ACTIVE_BG = NativeColors.surface;
const ACTIVE_BORDER = NativeColors.border;
const ACTIVE_LABEL = NativeColors.text;
const INACTIVE_LABEL = NativeColors.textMuted;

/** Native (React Native) implementation of the SegmentedControl contract. */
export function SegmentedControl({
  value,
  onChange,
  data,
  fullWidth,
  disabled,
  testID,
}: SegmentedControlProps) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "row",
        alignSelf: fullWidth ? "stretch" : "flex-start",
        backgroundColor: TRACK_BG,
        borderRadius: 8,
        padding: 3,
        gap: 3,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {data.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!disabled) onChange?.(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            style={{
              flex: fullWidth ? 1 : undefined,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 6,
              backgroundColor: active ? ACTIVE_BG : "transparent",
              borderWidth: active ? 1 : 0,
              borderColor: ACTIVE_BORDER,
              alignItems: "center",
            }}
          >
            <RNText
              style={{
                color: active ? ACTIVE_LABEL : INACTIVE_LABEL,
                fontSize: 14,
                fontWeight: active ? "600" : "400",
              }}
            >
              {option.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}
