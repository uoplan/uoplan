import { View } from "react-native";

import { resolveSpacing } from "../layout/style";
import type { SpaceProps } from "./Space.types";

/** Native (React Native) implementation of the Space contract. */
export function Space({ h, w, testID }: SpaceProps) {
  return <View testID={testID} style={{ height: resolveSpacing(h), width: resolveSpacing(w) }} />;
}
