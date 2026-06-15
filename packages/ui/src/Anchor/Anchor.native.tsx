import { Text as RNText } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { AnchorProps } from "./Anchor.types";

const ACCENT = NativeColors.accent;

/** Native (React Native) implementation of the Anchor contract. */
export function Anchor({ children, onPress, testID }: AnchorProps) {
  return (
    <RNText
      testID={testID}
      onPress={onPress}
      accessibilityRole="link"
      style={{ color: ACCENT, textDecorationLine: "underline" }}
    >
      {children}
    </RNText>
  );
}
