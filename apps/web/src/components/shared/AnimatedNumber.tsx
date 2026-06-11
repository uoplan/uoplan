import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface AnimatedNumberProps {
  /** Target numeric value. `null` renders `placeholder` with no animation. */
  value: number | null;
  /** Formats the (interpolated) number for display each frame. */
  format: (value: number) => string;
  /** Rendered when `value` is `null`. */
  placeholder?: string;
  /** Tween duration in seconds. */
  duration?: number;
  /**
   * When `true`, the first appearance of a value (initial mount with a value, or
   * the first `null` → value transition) counts up from `from` instead of
   * snapping. Subsequent value changes always animate. Reduced motion still snaps.
   */
  countOnLoad?: boolean;
  /** Starting value for the `countOnLoad` count-up. Defaults to `0`. */
  from?: number;
}

// Strong ease-out (expo-like): ticks fast, then decelerates into the final value.
const COUNT_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function animateDisplayValue(
  start: number,
  value: number,
  duration: number,
  updateDisplay: (latest: number) => void,
) {
  const controls = animate(start, value, {
    duration,
    ease: COUNT_EASE,
    onUpdate: updateDisplay,
    onComplete: () => updateDisplay(value),
  });
  return () => controls.stop();
}

/**
 * Animates a number with a "counting" effect: on each value change it rapidly
 * interpolates between the previously displayed value and the new target,
 * decelerating until it settles on the exact final value.
 *
 * Does NOT count up on first mount (renders the value immediately) and snaps
 * without animating when transitioning to/from `null` or when the user prefers
 * reduced motion. The display reformats on every render, so locale/format
 * changes are reflected even while idle.
 *
 * Opt into a load-time count-up with `countOnLoad`: the first appearance of a
 * value animates from `from` (default `0`) up to the target.
 */
export function AnimatedNumber({
  value,
  format,
  placeholder = "—",
  duration = 0.7,
  countOnLoad = false,
  from = 0,
}: AnimatedNumberProps) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState<number>(value ?? 0);
  const displayedRef = useRef<number>(value ?? 0);
  const hadValueRef = useRef<boolean>(value != null);
  const isFirstRef = useRef<boolean>(true);

  useEffect(() => {
    if (value == null) {
      hadValueRef.current = false;
      return;
    }

    const cameFromNull = !hadValueRef.current;
    hadValueRef.current = true;

    const isAppearance = isFirstRef.current || cameFromNull;
    const updateDisplay = (latest: number) => {
      displayedRef.current = latest;
      setDisplay(latest);
    };

    if (countOnLoad && isAppearance && !prefersReduced) {
      isFirstRef.current = false;
      return animateDisplayValue(from, value, duration, updateDisplay);
    }

    if (isAppearance || prefersReduced) {
      isFirstRef.current = false;
      displayedRef.current = value;
      setDisplay(value);
      return;
    }

    isFirstRef.current = false;
    return animateDisplayValue(displayedRef.current, value, duration, updateDisplay);
  }, [value, prefersReduced, duration, countOnLoad, from]);

  return <>{value == null ? placeholder : format(display)}</>;
}
