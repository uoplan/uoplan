import type { ReactNode } from "react";

/**
 * Shared prop contract for the Tooltip primitive — a hover/long-press hint that
 * wraps a target. Web maps onto Mantine's `Tooltip`; native has no hover, so the
 * native variant renders the target as a passthrough (tooltips are a no-op on
 * touch). `label` is the hint text shown on web.
 */
export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  /** Test hook: maps to `data-testid` (web). */
  testID?: string;
}
