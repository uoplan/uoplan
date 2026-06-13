import type { ReactNode } from "react";

import type { Spacing } from "../layout/style";

/**
 * Shared prop contract for the Container primitive — a centred, max-width
 * content column. Web maps onto Mantine's `Container`; native maps onto a
 * centred React Native `View`.
 */
export interface ContainerProps {
  children?: ReactNode;
  /** Max content width in pixels. Defaults to 960 (the app content width). */
  maxWidth?: number;
  /** Horizontal padding. */
  px?: Spacing;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
