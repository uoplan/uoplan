import type { ReactNode } from "react";

/** Edge from which the Drawer slides in. */
export type DrawerPosition = "left" | "right" | "top" | "bottom";

/**
 * Shared prop contract for the Drawer primitive — a panel that slides in from a
 * screen edge. Web maps onto Mantine's `Drawer`; native maps onto a React Native
 * `Modal` with an edge-anchored panel + dimmed backdrop.
 */
export interface DrawerProps {
  /** Whether the drawer is visible. */
  opened: boolean;
  /** Fired when the user dismisses the drawer (backdrop tap). */
  onClose: () => void;
  /** Optional header title. */
  title?: string;
  /** Edge to anchor to (defaults to "right"). */
  position?: DrawerPosition;
  children?: ReactNode;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
