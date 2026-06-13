import type { Spacing } from "../layout/style";

export type DividerOrientation = "horizontal" | "vertical";

/**
 * Shared prop contract for the Divider primitive — a 1px separator line. Web
 * maps onto Mantine's `Divider`; native maps onto a thin React Native `View`.
 */
export interface DividerProps {
  /** Line direction. Defaults to `horizontal`. */
  orientation?: DividerOrientation;
  /** Vertical margin (for horizontal dividers). */
  my?: Spacing;
  /** Horizontal margin (for vertical dividers). */
  mx?: Spacing;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
