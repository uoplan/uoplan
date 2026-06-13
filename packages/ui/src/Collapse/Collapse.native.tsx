import { View } from "react-native";

import type { CollapseProps } from "./Collapse.types";

/** Native (React Native) implementation of the Collapse contract. */
export function Collapse({ open, children, testID }: CollapseProps) {
  return <View testID={testID}>{open ? children : null}</View>;
}
