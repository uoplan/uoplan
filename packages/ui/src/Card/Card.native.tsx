import { View } from "react-native";

import { resolveRadius, resolveSpacing } from "../layout/style";
import type { CardProps } from "./Card.types";

const SURFACE_BG = "#fffdfa";
const BORDER_COLOR = "#ebe6dd";

/** Native (React Native) implementation of the Card contract. */
export function Card({ children, p = "md", radius = "md", withBorder = true, testID }: CardProps) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: SURFACE_BG,
        padding: resolveSpacing(p),
        borderRadius: resolveRadius(radius),
        borderWidth: withBorder ? 1 : undefined,
        borderColor: withBorder ? BORDER_COLOR : undefined,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}
