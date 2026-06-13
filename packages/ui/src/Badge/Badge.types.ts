import type { ReactNode } from "react";

import type { BadgeTone } from "./tones";

/**
 * Shared prop contract for the Badge primitive — a small pill label. Web maps
 * onto Mantine's `Badge`; native maps onto a React Native pill (`View` + `Text`).
 */
export interface BadgeProps {
  children?: ReactNode;
  /** Colour tone. Defaults to `neutral`. */
  tone?: BadgeTone;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
