import type { ReactNode } from "react";

export type TitleOrder = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Shared prop contract for the Title primitive — a semantic heading. Web maps
 * onto Mantine's `Title` (`<h1>`–`<h6>` via `order`); native maps onto a React
 * Native `Text` with `accessibilityRole="header"`.
 */
export interface TitleProps {
  children?: ReactNode;
  /** Heading level 1–6. Defaults to 1. */
  order?: TitleOrder;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
