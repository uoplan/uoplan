import type { ReactNode } from "react";

import type { Spacing } from "../layout/style";

/**
 * Shared prop contract for the SimpleGrid primitive — an equal-width grid with
 * a fixed column count. Web maps onto Mantine's `SimpleGrid` (CSS grid); native
 * maps onto a wrapped flex row whose cells share the available width.
 */
export interface SimpleGridProps {
  children?: ReactNode;
  /** Number of equal-width columns. */
  cols: number;
  /** Gap between cells (both axes). */
  spacing?: Spacing;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
