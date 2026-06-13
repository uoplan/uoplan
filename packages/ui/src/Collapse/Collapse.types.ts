import type { ReactNode } from "react";

/**
 * Shared prop contract for the Collapse primitive — a container that shows or
 * hides its children based on `open`. Web maps onto Mantine's animated
 * `Collapse`; native mounts/unmounts the children.
 */
export interface CollapseProps {
  /** Whether the content is visible. */
  open: boolean;
  children?: ReactNode;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
