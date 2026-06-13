import type { ReactNode } from "react";

import type { BadgeTone } from "../Badge/tones";

/**
 * Shared prop contract for the Indicator primitive — a small dot or count badge
 * overlaid on a corner of its children. Web maps onto Mantine's `Indicator`;
 * native onto an absolutely-positioned overlay. Colours come from the shared
 * {@link BadgeTone} palette. When `label` is omitted a plain dot is shown;
 * native expects a string/number label.
 */
export type IndicatorPosition = "top-start" | "top-end" | "bottom-start" | "bottom-end";

export interface IndicatorProps {
  /** The content the indicator is anchored to. */
  children?: ReactNode;
  /** Optional count/label; omit for a plain dot. */
  label?: ReactNode;
  tone?: BadgeTone;
  position?: IndicatorPosition;
  /** Hide the indicator without unmounting its children. */
  disabled?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
