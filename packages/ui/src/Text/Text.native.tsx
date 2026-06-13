import { Text as RNText } from "react-native";
import type { TextStyle } from "react-native";

import type { TextProps, TextSize, TextWeight } from "./Text.types";

const FONT_SIZE: Record<TextSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
};

const FONT_WEIGHT: Record<TextWeight, TextStyle["fontWeight"]> = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

const DEFAULT_COLOR = "#1f2933";
const DIMMED_COLOR = "#6b7280";

/** Native (React Native) implementation of the Text contract. */
export function Text({
  children,
  size,
  weight,
  color,
  align,
  dimmed,
  numberOfLines,
  testID,
}: TextProps) {
  return (
    <RNText
      testID={testID}
      numberOfLines={numberOfLines}
      style={{
        fontSize: size ? FONT_SIZE[size] : FONT_SIZE.md,
        fontWeight: weight ? FONT_WEIGHT[weight] : undefined,
        color: color ?? (dimmed ? DIMMED_COLOR : DEFAULT_COLOR),
        textAlign: align,
      }}
    >
      {children}
    </RNText>
  );
}
