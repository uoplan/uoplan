import type { ReactNode } from "react";

/**
 * A minimal, portable subset of the animatable visual state — enough for the
 * mount/enter (and optional exit) transitions the app actually uses, without
 * leaking framer-motion's or reanimated's full API into shared screens. Values
 * are absolute (not deltas): `opacity` 0–1, `translateY` in px, `scale` as a
 * multiplier.
 */
export interface MotionState {
  opacity?: number;
  translateY?: number;
  scale?: number;
}

/**
 * Shared prop contract for the Motion primitive — an animated container. Web
 * maps onto `framer-motion`'s `motion.div`; native maps onto a
 * `react-native-reanimated` `Animated.View`. The element animates from `from`
 * to `to` on mount (and, inside an {@link AnimatePresence}, animates `from` on
 * unmount on web).
 */
export interface MotionProps {
  children?: ReactNode;
  /** Visual state before the enter animation. Defaults to fully visible. */
  from?: MotionState;
  /** Target visual state. Defaults to fully visible. */
  to?: MotionState;
  /** Duration in milliseconds. Defaults to 220. */
  duration?: number;
  /** Delay before the animation starts, in milliseconds. Defaults to 0. */
  delay?: number;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

/** Resolve a {@link MotionState} to concrete values with sensible defaults. */
export function resolveMotionState(state: MotionState | undefined): Required<MotionState> {
  return {
    opacity: state?.opacity ?? 1,
    translateY: state?.translateY ?? 0,
    scale: state?.scale ?? 1,
  };
}

export const DEFAULT_MOTION_DURATION = 220;
