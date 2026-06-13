import { Text as RNText, View } from "react-native";

import type { PillProps } from "./Pill.types";

const BG = "#f0ede8";
const FG = "#2a2826";

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
