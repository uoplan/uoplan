import { View } from "react-native";

import { resolveSpacing } from "../layout/style";
import type { DividerProps } from "./Divider.types";

const BORDER_COLOR = "#ebe6dd";

/** Native (React Native) implementation of the Divider contract. */
export function Divider({ orientation = "horizontal", my, mx, testID }: DividerProps) {
  const horizontal = orientation === "horizontal";
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: BORDER_COLOR,
        height: horizontal ? 1 : "100%",
        width: horizontal ? "100%" : 1,
        marginVertical: resolveSpacing(my),
        marginHorizontal: resolveSpacing(mx),
      }}
    />
  );
}
