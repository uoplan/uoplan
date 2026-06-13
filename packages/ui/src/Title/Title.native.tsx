import { Text as RNText } from "react-native";

import type { TitleOrder, TitleProps } from "./Title.types";

const FONT_SIZE: Record<TitleOrder, number> = {
  1: 30,
  2: 26,
  3: 22,
  4: 18,
  5: 16,
  6: 14,
};

const DEFAULT_COLOR = "#1f2933";

/** Native (React Native) implementation of the Title contract. */
export function Title({ children, order = 1, testID }: TitleProps) {
  return (
    <RNText
      testID={testID}
      accessibilityRole="header"
      style={{ fontSize: FONT_SIZE[order], fontWeight: "700", color: DEFAULT_COLOR }}
    >
      {children}
    </RNText>
  );
}
