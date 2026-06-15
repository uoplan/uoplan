import { mergeBlockedWindows } from "@uoplan/core";
import type { BlockedTimeWindow, DayOfWeek } from "@uoplan/core";
import type { BlockedTime } from "./types";
import {
  AVOID_DAY_END_MINUTES,
  AVOID_DAY_START_MINUTES,
  DEFAULT_AVOIDED_DAYS,
} from "./generationDefaults";

/** Stable, unique id for a normalized window (no two same-day windows share a start). */
export function blockedWindowId(w: BlockedTimeWindow): string {
  return `${w.day}-${w.startMinutes}-${w.endMinutes}`;
}

/** Strip local ids down to the core window shape used by generation and encoding. */
export function toBlockedWindows(blocks: readonly BlockedTime[]): BlockedTimeWindow[] {
  return blocks.map(({ day, startMinutes, endMinutes }) => ({ day, startMinutes, endMinutes }));
}

/** Re-attach deterministic ids to core windows (e.g. after decoding shared state). */
export function withBlockedIds(windows: readonly BlockedTimeWindow[]): BlockedTime[] {
  return windows.map((w) => ({ id: blockedWindowId(w), ...w }));
}

/** Merge overlapping same-day windows and reassign deterministic ids. */
export function normalizeBlockedTimes(blocks: readonly BlockedTime[]): BlockedTime[] {
  return withBlockedIds(mergeBlockedWindows(toBlockedWindows(blocks)));
}

/** The full-day window that represents "avoid this day". */
export function avoidWindowForDay(day: DayOfWeek): BlockedTimeWindow {
  return { day, startMinutes: AVOID_DAY_START_MINUTES, endMinutes: AVOID_DAY_END_MINUTES };
}

/** Default blocked windows for a fresh/cleared state: the weekend is avoided. */
export function defaultBlockedTimes(): BlockedTime[] {
  return withBlockedIds(DEFAULT_AVOIDED_DAYS.map(avoidWindowForDay));
}

/** True when some window on `day` covers the whole avoid span (robust to merged/wider windows). */
export function isDayAvoided(blocks: readonly BlockedTime[], day: DayOfWeek): boolean {
  return blocks.some(
    (b) =>
      b.day === day &&
      b.startMinutes <= AVOID_DAY_START_MINUTES &&
      b.endMinutes >= AVOID_DAY_END_MINUTES,
  );
}

/** The set of days currently avoided, derived purely from the blocked windows. */
export function avoidedDaysFromBlocks(blocks: readonly BlockedTime[]): DayOfWeek[] {
  const days: DayOfWeek[] = [];
  for (const b of blocks) {
    if (isDayAvoided(blocks, b.day) && !days.includes(b.day)) days.push(b.day);
  }
  return days;
}

/**
 * Reconcile blocked windows so the avoided-day set equals `avoidedDays`.
 * - Days newly avoided gain a full avoid window.
 * - Days no longer avoided have the avoid span subtracted from their windows,
 *   preserving any remainder outside [AVOID_DAY_START_MINUTES, AVOID_DAY_END_MINUTES].
 * Result is normalized (merged + deterministic ids).
 */
export function reconcileAvoidedDays(
  blocks: readonly BlockedTime[],
  avoidedDays: readonly DayOfWeek[],
): BlockedTime[] {
  const target = new Set(avoidedDays);
  const windows: BlockedTimeWindow[] = [];
  for (const b of blocks) {
    if (target.has(b.day)) {
      // Day stays avoided: keep the window untouched.
      windows.push(toWindow(b));
    } else if (isDayAvoidedWindow(b)) {
      // Day no longer avoided: drop the avoid span, keep any remainder.
      windows.push(...subtractAvoidSpan(b));
    } else {
      // Partial block on a non-avoided day: leave as-is.
      windows.push(toWindow(b));
    }
  }
  for (const day of target) {
    if (!isDayAvoided(blocks, day)) windows.push(avoidWindowForDay(day));
  }
  return normalizeBlockedTimes(withBlockedIds(windows));
}

function toWindow(b: BlockedTime): BlockedTimeWindow {
  return { day: b.day, startMinutes: b.startMinutes, endMinutes: b.endMinutes };
}

function isDayAvoidedWindow(b: BlockedTime): boolean {
  return b.startMinutes <= AVOID_DAY_START_MINUTES && b.endMinutes >= AVOID_DAY_END_MINUTES;
}
function subtractAvoidSpan(b: BlockedTime): BlockedTimeWindow[] {
  const pieces: BlockedTimeWindow[] = [];
  if (b.startMinutes < AVOID_DAY_START_MINUTES) {
    pieces.push({ day: b.day, startMinutes: b.startMinutes, endMinutes: AVOID_DAY_START_MINUTES });
  }
  if (b.endMinutes > AVOID_DAY_END_MINUTES) {
    pieces.push({ day: b.day, startMinutes: AVOID_DAY_END_MINUTES, endMinutes: b.endMinutes });
  }
  return pieces;
}
