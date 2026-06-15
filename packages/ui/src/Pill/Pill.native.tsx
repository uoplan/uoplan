import { Text as RNText, View } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { PillProps } from "./Pill.types";

const BG = NativeColors.surfaceHover;
const FG = NativeColors.text;

/** Native (React Native) implementation of the Pill contract. */
export function Pill({ children, testID }: PillProps) {
  return (
    <View
      testID={testID}
      style={{
        alignSelf: "flex-start",
        backgroundColor: BG,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <RNText style={{ color: FG, fontSize: 13 }}>{children}</RNText>
    </View>
  );
}
