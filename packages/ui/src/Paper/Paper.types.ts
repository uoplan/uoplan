import type { ReactNode } from "react";

import type { Radius, Spacing } from "../layout/style";

export type SurfaceShadow = "none" | "sm" | "md" | "lg";

/**
 * Shared prop contract for the Paper primitive — an elevated surface. Web maps
 * onto Mantine's `Paper`; native maps onto a React Native `View` styled as a
 * card surface.
 */
export interface PaperProps {
  children?: ReactNode;
  /** Inner padding. */
  p?: Spacing;
  /** Corner radius. */
  radius?: Radius;
  /** Draw a 1px border. */
  withBorder?: boolean;
  /** Drop-shadow elevation. */
  shadow?: SurfaceShadow;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
