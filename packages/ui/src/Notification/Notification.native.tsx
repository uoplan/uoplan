import { Pressable, Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { AlertTone } from "../Alert/tones";
import type { NotificationProps } from "./Notification.types";

const ACCENT: Record<AlertTone, string> = {
  info: NativeColors.tone.info.fg,
  success: NativeColors.tone.success.fg,
  warning: NativeColors.tone.warning.fg,
  danger: NativeColors.tone.danger.fg,
  neutral: NativeColors.textMuted,
};
const SURFACE = NativeColors.surface;
const BORDER_COLOR = NativeColors.border;
const LABEL = NativeColors.text;
const DIMMED = NativeColors.textMuted;

/** Native (React Native) implementation of the Notification contract. */
export function Notification({
  title,
  children,
  tone = "info",
  onClose,
  testID,
}: NotificationProps) {
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        borderLeftWidth: 4,
        borderLeftColor: ACCENT[tone],
        borderRadius: 8,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        {title != null && (
          <RNText style={{ color: LABEL, fontSize: 15, fontWeight: "600" }}>{title}</RNText>
        )}
        {typeof children === "string" ? (
          <RNText style={{ color: DIMMED, fontSize: 14 }}>{children}</RNText>
        ) : (
          children
        )}
      </View>
      {onClose != null && (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <RNText style={{ color: DIMMED, fontSize: 16 }}>×</RNText>
        </Pressable>
      )}
    </View>
  );
}
