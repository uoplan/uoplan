import { View } from "react-native";
import type { DimensionValue } from "react-native";

import type { SkeletonProps } from "./Skeleton.types";

const MUTED = "#ebe6dd";

/** Native (React Native) implementation of the Skeleton contract. */
export function Skeleton({ width, height = 16, radius = 4, testID }: SkeletonProps) {
  return (
    <View
      testID={testID}
      style={{
        width: (width ?? "100%") as DimensionValue,
        height,
        borderRadius: radius,
        backgroundColor: MUTED,
      }}
    />
  );
}
