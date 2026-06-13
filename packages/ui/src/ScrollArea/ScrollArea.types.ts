import type { ReactNode } from "react";

/**
 * Shared prop contract for the ScrollArea primitive — a scrollable viewport.
 * Web maps onto Mantine's `ScrollArea`; native maps onto a React Native
 * `ScrollView`.
 */
export interface ScrollAreaProps {
  children?: ReactNode;
  /** Scroll axis. Defaults to `vertical`. */
  direction?: "vertical" | "horizontal";
  /** Fill the available cross-axis space (native: `flex: 1`). */
  fill?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
