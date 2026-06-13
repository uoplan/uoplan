import { Text as RNText, View } from "react-native";

import type { AlertProps } from "./Alert.types";
import type { AlertTone } from "./tones";

const ALERT_TONES: Record<AlertTone, { bg: string; border: string; fg: string }> = {
  info: { bg: "#e8f1fc", border: "#bcd6f5", fg: "#2f5fa6" },
  success: { bg: "#e6f4ea", border: "#bfe3cb", fg: "#2f7a4a" },
  warning: { bg: "#fdf0e0", border: "#f3d9b0", fg: "#9a5a17" },
  danger: { bg: "#fdecec", border: "#f5c6c4", fg: "#b4302d" },
  neutral: { bg: "#f0ede8", border: "#ddd7cc", fg: "#5e5a52" },
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
