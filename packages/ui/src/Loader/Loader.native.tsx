import { ActivityIndicator } from "react-native";

import type { LoaderProps } from "./Loader.types";

const ACCENT = "#3673cb";

/** Native (React Native) implementation of the Loader contract. */
export function Loader({ size = "md", testID }: LoaderProps) {
  return (
    <ActivityIndicator testID={testID} size={size === "sm" ? "small" : "large"} color={ACCENT} />
  );
}
