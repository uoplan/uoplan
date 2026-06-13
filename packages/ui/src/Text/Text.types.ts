import type { ReactNode } from "react";

export type TextSize = "xs" | "sm" | "md" | "lg" | "xl";
export type TextWeight = "regular" | "medium" | "semibold" | "bold";
export type TextAlign = "left" | "center" | "right";

/**
 * Shared prop contract for the Text primitive. Web maps onto Mantine's `Text`;
 * native maps onto a React Native `Text`. Sizes/weights are semantic tokens so
 * typography stays consistent across platforms.
 */
export interface TextProps {
  children?: ReactNode;
  size?: TextSize;
  weight?: TextWeight;
  /** Explicit colour (CSS/RN colour string). Overrides `dimmed`. */
  color?: string;
  align?: TextAlign;
  /** Render in the muted/secondary colour. */
  dimmed?: boolean;
  /** Truncate after N lines with an ellipsis. */
  numberOfLines?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
