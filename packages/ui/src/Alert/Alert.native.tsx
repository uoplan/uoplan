import { Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { AlertProps } from "./Alert.types";
import type { AlertTone } from "./tones";

const ALERT_TONES: Record<AlertTone, { bg: string; border: string; fg: string }> = {
  info: {
    bg: NativeColors.tone.info.soft,
    border: NativeColors.tone.info.fg,
    fg: NativeColors.tone.info.fg,
  },
  success: {
    bg: NativeColors.tone.success.soft,
    border: NativeColors.tone.success.fg,
    fg: NativeColors.tone.success.fg,
  },
  warning: {
    bg: NativeColors.tone.warning.soft,
    border: NativeColors.tone.warning.fg,
    fg: NativeColors.tone.warning.fg,
  },
  danger: {
    bg: NativeColors.tone.danger.soft,
    border: NativeColors.tone.danger.fg,
    fg: NativeColors.tone.danger.fg,
  },
  neutral: {
    bg: NativeColors.surfaceHover,
    border: NativeColors.border,
    fg: NativeColors.textMuted,
  },
};

/** Native (React Native) implementation of the Alert contract. */
export function Alert({ children, title, tone = "info", testID }: AlertProps) {
  const colors = ALERT_TONES[tone];
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        gap: 4,
      }}
    >
      {title ? (
        <RNText style={{ color: colors.fg, fontSize: 15, fontWeight: "600" }}>{title}</RNText>
      ) : null}
      {typeof children === "string" ? (
        <RNText style={{ color: colors.fg, fontSize: 14 }}>{children}</RNText>
      ) : (
        children
      )}
    </View>
  );
}
