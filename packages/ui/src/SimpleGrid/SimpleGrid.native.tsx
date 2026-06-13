import { Children } from "react";
import { View } from "react-native";

import { resolveSpacing } from "../layout/style";
import type { SimpleGridProps } from "./SimpleGrid.types";

/**
 * Native (React Native) implementation of the SimpleGrid contract. Each cell
 * takes `100 / cols`% width with half-gap padding on every side. Because React
 * Native uses border-box sizing, the cells in a row sum to exactly 100% of the
 * parent — so the grid never overflows its container (unlike the negative-margin
 * technique, which reports an intrinsic width wider than the parent and breaks
 * inside an indefinite-width vertical ScrollView). The visible gap between cells
 * is `spacing`; the outer edge carries a half-gap inset.
 */
export function SimpleGrid({ children, cols, spacing, testID }: SimpleGridProps) {
  const gap = resolveSpacing(spacing) ?? 0;
  const half = gap / 2;
  return (
    <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {Children.map(children, (child) => (
        <View style={{ width: `${100 / cols}%`, padding: half }}>{child}</View>
      ))}
    </View>
  );
}
