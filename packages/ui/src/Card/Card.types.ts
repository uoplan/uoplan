import type { ReactNode } from "react";

import type { Radius, Spacing } from "../layout/style";
import type { SurfaceShadow } from "../Paper/Paper.types";

/**
 * Shared prop contract for the Card primitive — a content surface, typically
 * used for list/result cards. Web maps onto Mantine's `Card`; native maps onto
 * a React Native `View` styled as a card surface.
 */
export interface CardProps {
  children?: ReactNode;
  /** Inner padding. Defaults to `md`. */
  p?: Spacing;
  /** Corner radius. Defaults to `md`. */
  radius?: Radius;
  /** Draw a 1px border. Defaults to true. */
  withBorder?: boolean;
  /** Drop-shadow elevation. */
  shadow?: SurfaceShadow;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
