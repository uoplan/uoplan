import { View } from "react-native";

import { resolveAlign, resolveJustify, resolveSpacing } from "../layout/style";
import type { GroupProps } from "./Group.types";

/** Native (React Native) implementation of the Group contract. */
export function Group({ children, gap, align, justify, wrap, flex, testID }: GroupProps) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "row",
        gap: resolveSpacing(gap),
        alignItems: resolveAlign(align) ?? "center",
        justifyContent: resolveJustify(justify),
        flexWrap: wrap ? "wrap" : "nowrap",
        flex,
      }}
    >
      {children}
    </View>
  );
}
