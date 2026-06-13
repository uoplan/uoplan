import type { ReactNode } from "react";

/**
 * Shared prop contract for the cross-platform Button primitive.
 *
 * This file is the single source of truth for the component's API. The
 * platform implementations (`Button.web.tsx` = Mantine, `Button.native.tsx` =
 * React Native) both consume these types so the surface can never drift.
 *
 * Note the API uses platform-neutral names (`onPress`, not web's `onClick`):
 * each adapter maps the contract onto its platform's idiom.
 */
export type ButtonVariant = "filled" | "light" | "outline" | "subtle" | "default";

export interface ButtonProps {
  children?: ReactNode;
  /** Fired on tap (native) / click (web). */
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
