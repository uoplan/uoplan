import { View } from "react-native";

import { resolveAlign, resolveJustify, resolveSpacing } from "../layout/style";
import type { FlexProps } from "./Flex.types";

/** Native (React Native) implementation of the Flex contract. */
export function Flex({
  children,
  direction = "row",
  gap,
  align,
  justify,
  wrap,
  flex,
  testID,
}: FlexProps) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: direction,
        gap: resolveSpacing(gap),
        alignItems: resolveAlign(align),
        justifyContent: resolveJustify(justify),
        flexWrap: wrap ? "wrap" : "nowrap",
        flex,
      }}
    >
      {children}
    </View>
  );
}
