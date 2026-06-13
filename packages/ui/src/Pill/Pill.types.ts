import type { ReactNode } from "react";

/**
 * Shared prop contract for the Pill primitive — a compact rounded token,
 * typically a removable filter chip. Web maps onto Mantine's `Pill`; native
 * maps onto a rounded React Native `View` + `Text`.
 */
export interface PillProps {
  children?: ReactNode;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
