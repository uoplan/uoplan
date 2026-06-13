import type { ReactNode } from "react";

/**
 * Shared prop contract for the Tabs primitive — a controlled tab bar that
 * renders the active panel. Web maps onto Mantine's compound `Tabs`; native
 * onto a pressable tab row plus the active item's content. The `items` model
 * (value + label + content) avoids exposing a platform-specific compound API.
 */
export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  /** Currently active tab value. */
  value: string;
  /** Fired with the newly selected tab value. */
  onChange: (value: string) => void;
  /** The tabs and their panels. */
  items: TabItem[];
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
