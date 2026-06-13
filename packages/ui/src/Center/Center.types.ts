import type { ReactNode } from "react";

/**
 * Shared prop contract for the Center primitive — centres its children on both
 * axes. Web maps onto Mantine's `Center`; native maps onto a centred React
 * Native `View`.
 */
export interface CenterProps {
  children?: ReactNode;
  /** Flex grow/shrink factor. */
  flex?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
