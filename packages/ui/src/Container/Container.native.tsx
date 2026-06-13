import { View } from "react-native";

import { resolveSpacing } from "../layout/style";
import type { ContainerProps } from "./Container.types";

/** Native (React Native) implementation of the Container contract. */
export function Container({ children, maxWidth = 960, px, testID }: ContainerProps) {
  return (
    <View
      testID={testID}
      style={{
        width: "100%",
        maxWidth,
        alignSelf: "center",
        paddingHorizontal: resolveSpacing(px),
      }}
    >
      {children}
    </View>
  );
}
