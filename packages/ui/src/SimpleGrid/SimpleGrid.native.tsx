import { Children } from "react";
import { View } from "react-native";

import { resolveSpacing } from "../layout/style";
import type { SimpleGridProps } from "./SimpleGrid.types";

/**
 * Native (React Native) implementation of the SimpleGrid contract. Uses the
 * negative-margin gutter technique: each cell takes `100 / cols`% width with
 * half-gap padding, and the container cancels the outer edge with a negative
 * margin so the visible gap between cells matches `spacing`.
 */
export function SimpleGrid({ children, cols, spacing, testID }: SimpleGridProps) {
  const gap = resolveSpacing(spacing) ?? 0;
  const half = gap / 2;
  return (
    <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", margin: -half }}>
      {Children.map(children, (child) => (
        <View style={{ width: `${100 / cols}%`, padding: half }}>{child}</View>
      ))}
    </View>
  );
}
