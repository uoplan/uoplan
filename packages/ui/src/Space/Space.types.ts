import type { Spacing } from "../layout/style";

/**
 * Shared prop contract for the Space primitive — a fixed-size spacer. Web maps
 * onto Mantine's `Space`; native maps onto an empty React Native `View`.
 */
export interface SpaceProps {
  /** Height. */
  h?: Spacing;
  /** Width. */
  w?: Spacing;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
