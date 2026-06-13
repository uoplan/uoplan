import type { ReactNode } from "react";

import type { Spacing } from "../layout/style";

/**
 * Shared prop contract for the Box layout primitive — a generic container with
 * padding/margin/flex. Web maps onto Mantine's `Box` (a styled `div`); native
 * maps onto a React Native `View`.
 *
 * Use the semantic spacing props (`p`/`px`/`py`/`m`/`mx`/`my`) rather than a
 * raw style object so layout stays portable across the CSS↔RN style gap.
 */
export interface BoxProps {
  children?: ReactNode;
  /** Padding on all sides. */
  p?: Spacing;
  /** Horizontal (left+right) padding. */
  px?: Spacing;
  /** Vertical (top+bottom) padding. */
  py?: Spacing;
  /** Margin on all sides. */
  m?: Spacing;
  /** Horizontal (left+right) margin. */
  mx?: Spacing;
  /** Vertical (top+bottom) margin. */
  my?: Spacing;
  /** Flex grow/shrink factor. */
  flex?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
