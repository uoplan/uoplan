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
}

// Strong ease-out (expo-like): ticks fast, then decelerates into the final value.
const COUNT_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Animates a number with a "counting" effect: on each value change it rapidly
 * interpolates between the previously displayed value and the new target,
 * decelerating until it settles on the exact final value.
 *
 * Does NOT count up on first mount (renders the value immediately) and snaps
 * without animating when transitioning to/from `null` or when the user prefers
 * reduced motion. The display reformats on every render, so locale/format
 * changes are reflected even while idle.
 */
export function AnimatedNumber({
  value,
  format,
  placeholder = "—",
  duration = 0.7,
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

    if (isFirstRef.current || cameFromNull || prefersReduced) {
      isFirstRef.current = false;
      displayedRef.current = value;
      setDisplay(value);
      return;
    }

    isFirstRef.current = false;
    const controls = animate(displayedRef.current, value, {
      duration,
      ease: COUNT_EASE,
      onUpdate: (latest) => {
        displayedRef.current = latest;
        setDisplay(latest);
      },
      onComplete: () => {
        displayedRef.current = value;
        setDisplay(value);
      },
    });
    return () => controls.stop();
  }, [value, prefersReduced, duration]);

  return <>{value == null ? placeholder : format(display)}</>;
}
