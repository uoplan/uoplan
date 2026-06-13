import { View } from "react-native";

import { resolveAlign, resolveJustify, resolveSpacing } from "../layout/style";
import type { StackProps } from "./Stack.types";

/** Native (React Native) implementation of the Stack contract. */
export function Stack({ children, gap, align, justify, flex, testID }: StackProps) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "column",
        gap: resolveSpacing(gap),
        alignItems: resolveAlign(align),
        justifyContent: resolveJustify(justify),
        flex,
      }}
    >
      {children}
    </View>
  );
}
