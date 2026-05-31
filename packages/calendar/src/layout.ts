import type { CalendarEvent } from "./types";
import type { DayOfWeekCode } from "@uoplan/core";

export const CAL_START_MINUTES = 480; // 08:00
export const CAL_END_MINUTES = 1380; // 23:00
const CAL_SPAN_MINUTES = CAL_END_MINUTES - CAL_START_MINUTES;

export function minutesToPercent(minutes: number): number {
  return ((minutes - CAL_START_MINUTES) / CAL_SPAN_MINUTES) * 100;
}

/** Inverse of {@link minutesToPercent}: a 0–100 vertical position back to minutes. */
export function percentToMinutes(percent: number): number {
  return CAL_START_MINUTES + (percent / 100) * CAL_SPAN_MINUTES;
}

/** Snap minutes to the nearest `step` grid (default 5 minutes). */
export function snapMinutes(minutes: number, step = 5): number {
  return Math.round(minutes / step) * step;
}

/** Clamp minutes to the visible calendar window [08:00, 23:00]. */
export function clampToCalendarRange(minutes: number): number {
  return Math.max(CAL_START_MINUTES, Math.min(CAL_END_MINUTES, minutes));
}

export const WEEKDAY_CODES: DayOfWeekCode[] = ["Mo", "Tu", "We", "Th", "Fr"];
export const FULL_WEEK_CODES: DayOfWeekCode[] = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const DAY_LABELS: Record<DayOfWeekCode, string> = {
  Mo: "Mon",
  Tu: "Tue",
  We: "Wed",
  Th: "Thu",
  Fr: "Fri",
  Sa: "Sat",
  Su: "Sun",
};

export interface LayoutEvent {
  event: CalendarEvent;
  laneIndex: number;
  laneCount: number;
}

/**
 * Assigns horizontal lanes to events in a single day column so overlapping
 * events tile side-by-side.
 */
export function assignLanes(events: CalendarEvent[]): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);

  const laneEnds: number[] = [];
  const laneIndices: number[] = Array.from({ length: sorted.length }, () => 0);

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    let placed = false;
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (laneEnds[lane] <= ev.startMinutes) {
        laneIndices[i] = lane;
        laneEnds[lane] = ev.endMinutes;
        placed = true;
        break;
      }
    }
    if (!placed) {
      laneIndices[i] = laneEnds.length;
      laneEnds.push(ev.endMinutes);
    }
  }

  const laneCount: number[] = Array.from({ length: sorted.length }, () => 1);
  let clusterEnd = 0;
  let clusterMaxLane = 0;
  let clusterStart = 0;

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.startMinutes >= clusterEnd) {
      const count = clusterMaxLane + 1;
      for (let j = clusterStart; j < i; j++) laneCount[j] = count;
      clusterStart = i;
      clusterMaxLane = laneIndices[i];
      clusterEnd = ev.endMinutes;
    } else {
      if (laneIndices[i] > clusterMaxLane) clusterMaxLane = laneIndices[i];
      if (ev.endMinutes > clusterEnd) clusterEnd = ev.endMinutes;
    }
  }
  const count = clusterMaxLane + 1;
  for (let j = clusterStart; j < sorted.length; j++) laneCount[j] = count;

  return sorted.map((event, i) => ({
    event,
    laneIndex: laneIndices[i],
    laneCount: laneCount[i],
  }));
}

export const HOUR_LABELS: { label: string; percent: number }[] = Array.from(
  { length: 15 },
  (_, i) => {
    const minutes = CAL_START_MINUTES + i * 60;
    const h = Math.floor(minutes / 60);
    return {
      label: `${String(h).padStart(2, "0")}:00`,
      percent: minutesToPercent(minutes),
    };
  },
);

export const HALF_HOUR_PERCENTS: number[] = Array.from({ length: 14 }, (_, i) =>
  minutesToPercent(CAL_START_MINUTES + i * 60 + 30),
);
