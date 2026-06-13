import type { ReactNode } from "react";

/**
 * Shared prop contract for the ActionIcon primitive — a compact, square,
 * icon-only button. Web maps onto Mantine's `ActionIcon`; native maps onto a
 * square pressable. Uses the platform-neutral `onPress` handler (mapped to
 * `onClick` on web).
 */
export type ActionIconVariant = "filled" | "light" | "subtle" | "default";
export type ActionIconSize = "sm" | "md" | "lg";

export interface ActionIconProps {
  /** The icon (or any node) rendered inside the square. */
  children?: ReactNode;
  /** Fired on tap (native) / click (web). */
  onPress?: () => void;
  variant?: ActionIconVariant;
  size?: ActionIconSize;
  disabled?: boolean;
  /** Accessible label — icon-only buttons must describe their action. */
  label?: string;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

/** Pixel dimension for each named ActionIcon size (shared by both adapters). */
export const ACTION_ICON_SIZE: Record<ActionIconSize, number> = {
  sm: 28,
  md: 34,
  lg: 42,
};
