import { Text as RNText } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { TitleOrder, TitleProps } from "./Title.types";

const FONT_SIZE: Record<TitleOrder, number> = {
  1: 30,
  2: 26,
  3: 22,
  4: 18,
  5: 16,
  6: 14,
};

const DEFAULT_COLOR = NativeColors.text;

/** Native (React Native) implementation of the Title contract. */
export function Title({ children, order = 1, testID }: TitleProps) {
  return (
    <RNText
      testID={testID}
      accessibilityRole="header"
      style={{
        fontFamily: "DM Serif Display",
        fontSize: FONT_SIZE[order],
        fontWeight: "400",
        color: DEFAULT_COLOR,
      }}
    >
      {children}
    </RNText>
  );
}
