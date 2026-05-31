import { mergeBlockedWindows, type BlockedTimeWindow } from "@uoplan/core";
import type { BlockedTime } from "../store/types";

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
