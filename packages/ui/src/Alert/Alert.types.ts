import type { ReactNode } from "react";

import type { AlertTone } from "./tones";

/**
 * Shared prop contract for the Alert primitive — a coloured callout box. Web
 * maps onto Mantine's `Alert`; native maps onto a tinted React Native `View`.
 */
export interface AlertProps {
  children?: ReactNode;
  title?: string;
  /** Colour tone. Defaults to `info`. */
  tone?: AlertTone;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
