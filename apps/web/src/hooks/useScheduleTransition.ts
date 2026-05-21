import { useState, useEffect, useRef, useCallback } from "react";
import type { GeneratedSchedule } from "@uoplan/schedule";

export type Phase = "idle" | "exiting" | "entering";

const EXIT_MS = 180;
const ENTER_MS = 220;

/**
 * Drives the schedule fade-out / fade-in animation.
 *
 * When `schedule` changes the hook starts an exit animation, swaps
 * `displayedSchedule` to the new value once the exit finishes, then plays
 * an enter animation.
 *
 * If another schedule arrives mid-animation:
 *  - during exit  → restart the exit timer (latest schedule shown at the end)
 *  - during enter → show the new schedule immediately and restart the enter
 *
 */
export function useScheduleTransition(
  schedule: GeneratedSchedule | null,
  prefersReduced: boolean,
): {
  displayedSchedule: GeneratedSchedule | null;
  animationPhase: Phase;
} {
  const [displayedSchedule, setDisplayedSchedule] = useState(schedule);
  const [phase, setPhase] = useState<Phase>("idle");

  const phaseRef = useRef<Phase>("idle");
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always holds the latest schedule so timers pick it up even if they
  // were set before this render.
  const latestScheduleRef = useRef(schedule);
  useEffect(() => {
    latestScheduleRef.current = schedule;
  }, [schedule]);

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

    const startEnter = () => {
      phaseRef.current = "entering";
      setPhase("entering");
      enterTimerRef.current = setTimeout(() => {
        enterTimerRef.current = null;
        phaseRef.current = "idle";
        setPhase("idle");
      }, ENTER_MS);
    };

    const startExit = () => {
      phaseRef.current = "exiting";
      setPhase("exiting");
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        setDisplayedSchedule(latestScheduleRef.current);
        startEnter();
      }, EXIT_MS);
    };

    // Clear any in-flight timers and (re)start the full exit → swap → enter
    // sequence. Handles idle, exiting (debounce rapid navigation), and
    // entering (interrupt the fade-in with a fresh transition).
    clearTimers();
    startExit();

    return clearTimers;
  }, [schedule, prefersReduced, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // When reduced motion is preferred, skip the animation entirely.
  return {
    displayedSchedule: prefersReduced ? schedule : displayedSchedule,
    animationPhase: prefersReduced ? "idle" : phase,
  };
}

/**
 * Same exit → swap → enter pattern as useScheduleTransition, but for
 * a numeric week index. When weekIndex changes the hook plays the exit
 * animation, updates displayedWeekIndex, then plays the enter animation.
 */
export function useWeekIndexTransition(
  weekIndex: number,
  prefersReduced: boolean,
): { displayedWeekIndex: number; animationPhase: Phase } {
  const [displayedWeekIndex, setDisplayedWeekIndex] = useState(weekIndex);
  const [phase, setPhase] = useState<Phase>("idle");

  const phaseRef = useRef<Phase>("idle");
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latestRef = useRef(weekIndex);
  useEffect(() => {
    latestRef.current = weekIndex;
  }, [weekIndex]);

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

    const startEnter = () => {
      phaseRef.current = "entering";
      setPhase("entering");
      enterTimerRef.current = setTimeout(() => {
        enterTimerRef.current = null;
        phaseRef.current = "idle";
        setPhase("idle");
      }, ENTER_MS);
    };

    const startExit = () => {
      phaseRef.current = "exiting";
      setPhase("exiting");
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        setDisplayedWeekIndex(latestRef.current);
        startEnter();
      }, EXIT_MS);
    };

    clearTimers();
    startExit();
    return clearTimers;
  }, [weekIndex, prefersReduced, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    displayedWeekIndex: prefersReduced ? weekIndex : displayedWeekIndex,
    animationPhase: prefersReduced ? "idle" : phase,
  };
}
