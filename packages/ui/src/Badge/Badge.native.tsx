import { Text as RNText, View } from "react-native";

import type { BadgeProps } from "./Badge.types";
import { BADGE_TONES } from "./tones";

/** Native (React Native) implementation of the Badge contract. */
export function Badge({ children, tone = "neutral", testID }: BadgeProps) {
  const colors = BADGE_TONES[tone];
  return (
    <View
      testID={testID}
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.bg,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <RNText style={{ color: colors.fg, fontSize: 12, fontWeight: "600" }}>{children}</RNText>
    </View>
  );
}
