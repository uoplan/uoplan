import { View } from "react-native";

import type { CenterProps } from "./Center.types";

/** Native (React Native) implementation of the Center contract. */
export function Center({ children, flex, testID }: CenterProps) {
  return (
    <View testID={testID} style={{ alignItems: "center", justifyContent: "center", flex }}>
      {children}
    </View>
  );
}
