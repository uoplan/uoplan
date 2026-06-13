import type { ReactNode } from "react";

/**
 * Shared prop contract for the Anchor primitive — an inline text link. Web maps
 * onto Mantine's `Anchor` (renders an `<a>`); native maps onto a pressable
 * React Native `Text`. `href` is honoured on web; native relies on `onPress`.
 */
export interface AnchorProps {
  children?: ReactNode;
  /** Navigation target (web `<a href>`). */
  href?: string;
  /** Fired on tap/click. */
  onPress?: () => void;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
