import { View } from "react-native";
import type { ViewStyle } from "react-native";

import { resolveRadius, resolveSpacing } from "../layout/style";
import type { PaperProps, SurfaceShadow } from "./Paper.types";

const SURFACE_BG = "#fffdfa";
const BORDER_COLOR = "#ebe6dd";

const SHADOW: Record<Exclude<SurfaceShadow, "none">, ViewStyle> = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
};

/** Native (React Native) implementation of the Paper contract. */
export function Paper({ children, p, radius, withBorder, shadow, testID }: PaperProps) {
  const shadowStyle = shadow && shadow !== "none" ? SHADOW[shadow] : undefined;
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: SURFACE_BG,
        padding: resolveSpacing(p),
        borderRadius: resolveRadius(radius),
        borderWidth: withBorder ? 1 : undefined,
        borderColor: withBorder ? BORDER_COLOR : undefined,
        ...shadowStyle,
      }}
    >
      {children}
    </View>
  );
}
