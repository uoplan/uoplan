import { useCallback, useEffect, useRef, useState } from "react";
import type { GeneratedSchedule } from "@uoplan/core";

type Phase = "idle" | "exiting" | "entering";

const EXIT_MS = 180;
const ENTER_MS = 220;

/**
 * Generic exit → swap → enter transition driver.
 *
 * When `value` changes the hook starts an exit animation, swaps the displayed
 * value to the new one once the exit finishes, then plays an enter animation.
 *
 * If a new value arrives mid-animation:
 *  - during exit  → restart the exit timer (latest value shown at the end)
 *  - during enter → swap immediately and restart the enter
 *
 * Equality is `===`, so object values transition on reference change and
 * primitives on value change.
 */
function useTimedTransition<T>(
  value: T,
  prefersReduced: boolean,
): { displayedValue: T; animationPhase: Phase } {
  const [displayedValue, setDisplayedValue] = useState(value);
  const [phase, setPhase] = useState<Phase>("idle");

  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always holds the latest value so timers pick it up even if they were set
  // before this render.
  const latestRef = useRef(value);
  useEffect(() => {
    latestRef.current = value;
  }, [value]);

  // Tracks the value the animation last reacted to. Initialised to the mount
  // value so the transition only fires on genuine changes — without this the
  // exit → enter sequence plays on first mount, making freshly generated
  // content flash as if it were regenerated.
  const animatedRef = useRef(value);

  const clearTimers = useCallback(() => {
    if (exitTimerRef.current != null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (enterTimerRef.current != null) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (prefersReduced) {
      clearTimers();
      return;
    }

    // Skip on mount (and StrictMode's double-invoke) and whenever the value is
    // unchanged, so we only animate genuine changes.
    if (value === animatedRef.current) {
      return;
    }
    animatedRef.current = value;

    const startEnter = () => {
      setPhase("entering");
      enterTimerRef.current = setTimeout(() => {
        enterTimerRef.current = null;
        setPhase("idle");
      }, ENTER_MS);
    };

    const startExit = () => {
      setPhase("exiting");
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        setDisplayedValue(latestRef.current);
        startEnter();
      }, EXIT_MS);
    };

    // Clear any in-flight timers and (re)start the full exit → swap → enter
    // sequence. Handles idle, exiting (debounce rapid navigation), and
    // entering (interrupt the fade-in with a fresh transition).
    clearTimers();
    startExit();

    return clearTimers;
  }, [value, prefersReduced, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    displayedValue: prefersReduced ? value : displayedValue,
    animationPhase: prefersReduced ? "idle" : phase,
  };
}

/**
 * Drives the schedule fade-out / fade-in animation. Thin wrapper around
 * {@link useTimedTransition}.
 */
export function useScheduleTransition(
  schedule: GeneratedSchedule | null,
  prefersReduced: boolean,
): {
  displayedSchedule: GeneratedSchedule | null;
  animationPhase: Phase;
} {
  const { displayedValue, animationPhase } = useTimedTransition(schedule, prefersReduced);
  return { displayedSchedule: displayedValue, animationPhase };
}

/**
 * Same exit → swap → enter pattern as {@link useScheduleTransition}, but for a
 * numeric week index.
 */
export function useWeekIndexTransition(
  weekIndex: number,
  prefersReduced: boolean,
): { displayedWeekIndex: number; animationPhase: Phase } {
  const { displayedValue, animationPhase } = useTimedTransition(weekIndex, prefersReduced);
  return { displayedWeekIndex: displayedValue, animationPhase };
}
