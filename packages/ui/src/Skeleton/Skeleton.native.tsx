import { View } from "react-native";
import type { DimensionValue } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { SkeletonProps } from "./Skeleton.types";

const MUTED = NativeColors.surfaceHover;

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
