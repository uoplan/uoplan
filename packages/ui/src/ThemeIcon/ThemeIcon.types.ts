import type { ReactNode } from "react";

import type { BadgeTone } from "../Badge/tones";
import type { Radius } from "../layout/style";

/**
 * Shared prop contract for the ThemeIcon primitive — a small, tinted, rounded
 * square that frames an icon. Web maps onto a Mantine `Box`; native onto a
 * React Native `View`. Colours come from the shared {@link BadgeTone} palette so
 * tints stay consistent with Badge.
 */
export type ThemeIconSize = "sm" | "md" | "lg";

export interface ThemeIconProps {
  /** The icon (or any node) framed by the tinted square. */
  children?: ReactNode;
  tone?: BadgeTone;
  size?: ThemeIconSize;
  radius?: Radius;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

/** Pixel dimension for each named ThemeIcon size (shared by both adapters). */
export const THEME_ICON_SIZE: Record<ThemeIconSize, number> = {
  sm: 24,
  md: 32,
  lg: 40,
};
