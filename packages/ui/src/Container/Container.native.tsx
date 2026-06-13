import { useWindowDimensions, View } from "react-native";

import { resolveSpacing } from "../layout/style";
import type { ContainerProps } from "./Container.types";

/**
 * Native (React Native) implementation of the Container contract. Resolves to a
 * DEFINITE width (`min(maxWidth, windowWidth)`) rather than `"100%"`: inside a
 * vertical ScrollView the cross axis is indefinite, so a percentage width can't
 * resolve and the View would balloon to `maxWidth`, overflowing the screen and
 * clipping its (and its siblings') content. Clamping to the window width keeps
 * the column full-bleed on phones and centred at `maxWidth` on wider screens.
 */
export function Container({ children, maxWidth = 960, px, testID }: ContainerProps) {
  const { width } = useWindowDimensions();
  return (
    <View
      testID={testID}
      style={{
        width: Math.min(maxWidth, width),
        alignSelf: "center",
        paddingHorizontal: resolveSpacing(px),
      }}
    >
      {children}
    </View>
  );
}
