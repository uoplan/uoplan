import type { ReactNode } from "react";

import type { Align, Justify, Spacing } from "../layout/style";

/**
 * Shared prop contract for the Stack primitive — a vertical flex container with
 * a uniform gap. Web maps onto Mantine's `Stack`; native maps onto a column
 * React Native `View` with `gap`.
 */
export interface StackProps {
  children?: ReactNode;
  /** Gap between children. */
  gap?: Spacing;
  /** Cross-axis (horizontal) alignment. */
  align?: Align;
  /** Main-axis (vertical) distribution. */
  justify?: Justify;
  /** Flex grow/shrink factor. */
  flex?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
