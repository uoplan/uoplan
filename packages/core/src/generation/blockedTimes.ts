import type { BlockedTimeWindow } from "./types";

/**
 * Normalizes a set of blocked windows: drops zero/negative-length windows and
 * merges windows that overlap OR touch on the same weekday into a single window.
 * Adjacent blocks (end === start) connect into one region. The result is sorted
 * by day then start time.
 */
export function mergeBlockedWindows(windows: readonly BlockedTimeWindow[]): BlockedTimeWindow[] {
  const byDay = new Map<string, BlockedTimeWindow[]>();
  for (const w of windows) {
    if (w.endMinutes <= w.startMinutes) continue;
    const list = byDay.get(w.day);
    if (list) list.push(w);
    else byDay.set(w.day, [w]);
  }

  const merged: BlockedTimeWindow[] = [];
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startMinutes - b.startMinutes);
    let current: BlockedTimeWindow = { ...list[0] };
    for (let i = 1; i < list.length; i++) {
      const next = list[i];
      // Overlapping or touching: a block starting at or before another ends merges.
      if (next.startMinutes <= current.endMinutes) {
        current.endMinutes = Math.max(current.endMinutes, next.endMinutes);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }

  merged.sort((a, b) => (a.day === b.day ? a.startMinutes - b.startMinutes : 0));
  return merged;
}
