import { View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { ProgressProps } from "./Progress.types";

const ACCENT = NativeColors.accent;
const TRACK_COLOR = NativeColors.border;

/** Native (React Native) implementation of the Progress contract. */
export function Progress({ value, testID }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{ height: 8, borderRadius: 999, backgroundColor: TRACK_COLOR, overflow: "hidden" }}
    >
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: ACCENT }} />
    </View>
  );
}
