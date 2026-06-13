import type { ReactNode } from "react";

/**
 * Shared prop contract for the Popover primitive — a floating panel anchored to
 * a target. Web maps onto Mantine's `Popover` (Target + Dropdown); native maps
 * onto a tap-to-open overlay (React Native `Modal` backdrop). Controlled via
 * `opened` + `onChange`; the consumer wires the `target`'s press to toggle
 * `opened`, and the primitive fires `onChange(false)` on outside dismiss.
 */
export interface PopoverProps {
  /** Whether the dropdown is visible. */
  opened: boolean;
  /** Fired when the open state should change (e.g. outside-press dismiss). */
  onChange: (opened: boolean) => void;
  /** The trigger element (always rendered; owns its own press → toggle). */
  target: ReactNode;
  /** The floating dropdown content (shown when `opened`). */
  children: ReactNode;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
