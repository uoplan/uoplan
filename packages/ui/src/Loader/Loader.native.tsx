import { ActivityIndicator } from "react-native";

import { NativeColors } from "../nativeTheme";
import type { LoaderProps } from "./Loader.types";

const ACCENT = NativeColors.accent;

/** Native (React Native) implementation of the Loader contract. */
export function Loader({ size = "md", testID }: LoaderProps) {
  return (
    <ActivityIndicator testID={testID} size={size === "sm" ? "small" : "large"} color={ACCENT} />
  );
}
