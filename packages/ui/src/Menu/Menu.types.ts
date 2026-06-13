import type { ReactNode } from "react";

/** A single actionable entry in a Menu dropdown. */
export interface MenuOption {
  /** Stable identifier (also used as the React key). */
  value: string;
  label: string;
  /** Fired when the entry is chosen (the menu closes afterwards). */
  onSelect: () => void;
}

/**
 * Shared prop contract for the Menu primitive — a tap-to-open list of actions
 * anchored to a target. Web maps onto Mantine's `Menu` (Target + Dropdown +
 * Item); native maps onto a tap-to-open overlay of pressable rows. The menu owns
 * its own open state internally on both platforms.
 */
export interface MenuProps {
  /** The trigger element (always rendered). */
  target: ReactNode;
  /** The actionable entries. */
  items: MenuOption[];
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
