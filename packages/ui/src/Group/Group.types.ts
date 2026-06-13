import type { ReactNode } from "react";

import type { Align, Justify, Spacing } from "../layout/style";

/**
 * Shared prop contract for the Group primitive — a horizontal flex container
 * with a uniform gap (cross-axis centred by default, matching Mantine). Web
 * maps onto Mantine's `Group`; native maps onto a row React Native `View`.
 */
export interface GroupProps {
  children?: ReactNode;
  /** Gap between children. */
  gap?: Spacing;
  /** Cross-axis (vertical) alignment. Defaults to `center`. */
  align?: Align;
  /** Main-axis (horizontal) distribution. */
  justify?: Justify;
  /** Allow children to wrap onto multiple lines. */
  wrap?: boolean;
  /** Flex grow/shrink factor. */
  flex?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
