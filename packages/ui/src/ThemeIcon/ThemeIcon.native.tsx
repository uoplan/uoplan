import { View } from "react-native";

import { BADGE_TONES } from "../Badge/tones";
import { resolveRadius } from "../layout/style";
import { THEME_ICON_SIZE } from "./ThemeIcon.types";
import type { ThemeIconProps } from "./ThemeIcon.types";

/** Native (React Native) implementation of the ThemeIcon contract. */
export function ThemeIcon({
  children,
  tone = "accent",
  size = "md",
  radius = "md",
  testID,
}: ThemeIconProps) {
  const colors = BADGE_TONES[tone];
  const dimension = THEME_ICON_SIZE[size];
  return (
    <View
      testID={testID}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: resolveRadius(radius),
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}
