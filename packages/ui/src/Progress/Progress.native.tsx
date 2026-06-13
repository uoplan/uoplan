import { View } from "react-native";

import type { ProgressProps } from "./Progress.types";

const ACCENT = "#3673cb";
const TRACK_COLOR = "#ebe6dd";

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
