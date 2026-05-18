import { useState, useEffect, useRef, useCallback } from "react";
import type { GeneratedSchedule } from "schedule";

type Phase = "idle" | "exiting" | "entering";

const TRANSITION_MS = 100;

/**
 * Manages schedule switch animations.
 *
 * Returns a `displayedSchedule` that lags behind the real schedule: it only
 * swaps to the new value AFTER the exit animation finishes, so the exit plays
 * on old events and the enter plays on new ones.
 *
 * Call captureAndPark() before changing the schedule prop, then update the
 * schedule prop. The hook drives the rest.
 */
export function useScheduleTransition(
  schedule: GeneratedSchedule | null,
  prefersReduced: boolean,
): {
  displayedSchedule: GeneratedSchedule | null;
  animationPhase: Phase;
  captureAndPark: () => void;
} {
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayedSchedule, setDisplayedSchedule] = useState(schedule);

  const phaseRef = useRef<Phase>("idle");
  const pendingScheduleRef = useRef(schedule);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

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

  const captureAndPark = useCallback(() => {
    if (prefersReduced || phaseRef.current !== "idle") return;
    setPhaseSync("exiting");
  }, [prefersReduced, setPhaseSync]);

  // Track the latest incoming schedule so the exit timer can pick it up.
  useEffect(() => {
    pendingScheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    if (phaseRef.current !== "exiting") return;

    clearTimers();

    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setDisplayedSchedule(pendingScheduleRef.current);
      setPhaseSync("entering");

      enterTimerRef.current = setTimeout(() => {
        enterTimerRef.current = null;
        setPhaseSync("idle");
      }, TRANSITION_MS + 50);
    }, TRANSITION_MS);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  // If no animation is running, keep displayedSchedule in sync immediately.
  useEffect(() => {
    if (phaseRef.current === "idle") {
      setDisplayedSchedule(schedule);
    }
  }, [schedule]);

  // Cleanup on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  return { displayedSchedule, animationPhase: phase, captureAndPark };
}
