import type { ReactNode } from "react";

import type { Align, Justify, Spacing } from "../layout/style";

/**
 * Shared prop contract for the Flex primitive — a generic flex container whose
 * direction is configurable. Web maps onto Mantine's `Flex`; native maps onto a
 * React Native `View`.
 */
export interface FlexProps {
  children?: ReactNode;
  /** Flex direction. Defaults to `row`. */
  direction?: "row" | "column";
  /** Gap between children. */
  gap?: Spacing;
  /** Cross-axis alignment. */
  align?: Align;
  /** Main-axis distribution. */
  justify?: Justify;
  /** Allow children to wrap onto multiple lines. */
  wrap?: boolean;
  /** Flex grow/shrink factor. */
  flex?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
