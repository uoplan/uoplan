import { ScrollView } from "react-native";

import type { ScrollAreaProps } from "./ScrollArea.types";

/** Native (React Native) implementation of the ScrollArea contract. */
export function ScrollArea({ children, direction = "vertical", fill, testID }: ScrollAreaProps) {
  return (
    <ScrollView
      testID={testID}
      horizontal={direction === "horizontal"}
      style={fill ? { flex: 1 } : undefined}
    >
      {children}
    </ScrollView>
  );
}
