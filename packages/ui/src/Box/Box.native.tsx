import { View } from "react-native";

import { resolveSpacing } from "../layout/style";
import type { BoxProps } from "./Box.types";

/** Native (React Native) implementation of the Box contract. */
export function Box({ children, p, px, py, m, mx, my, flex, testID }: BoxProps) {
  return (
    <View
      testID={testID}
      style={{
        padding: resolveSpacing(p),
        paddingHorizontal: resolveSpacing(px),
        paddingVertical: resolveSpacing(py),
        margin: resolveSpacing(m),
        marginHorizontal: resolveSpacing(mx),
        marginVertical: resolveSpacing(my),
        flex,
      }}
    >
      {children}
    </View>
  );
}
