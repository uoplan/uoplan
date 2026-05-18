import type { CalendarEvent } from "../../../hooks/useCalendarEvents";
import type { DayOfWeekCode } from "schedule";

const CAL_START_MINUTES = 480; // 08:00
const CAL_END_MINUTES = 1380; // 23:00
const CAL_SPAN_MINUTES = CAL_END_MINUTES - CAL_START_MINUTES;

export function minutesToPercent(minutes: number): number {
  return ((minutes - CAL_START_MINUTES) / CAL_SPAN_MINUTES) * 100;
}

export const WEEKDAY_CODES: DayOfWeekCode[] = ["Mo", "Tu", "We", "Th", "Fr"];
/** Full week order (Sunday first, Saturday last). */
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

interface LayoutEvent {
  event: CalendarEvent;
  laneIndex: number;
  laneCount: number;
}

/**
 * Assigns horizontal lanes to events in a single day column so overlapping
 * events tile side-by-side. Uses a greedy sweep: each event is placed in the
 * first lane whose last end-time is ≤ the event's start. After assignment a
 * second pass promotes laneCount to the maximum within each overlapping cluster
 * so all events in the same cluster share the same column width.
 */
export function assignLanes(events: CalendarEvent[]): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);

  // lane → end minute of the last event placed there
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

  // Compute laneCount per overlapping cluster using a sweep.
  // A cluster is a maximal set of events whose time ranges all overlap with
  // at least one other in the set.
  const laneCount: number[] = Array.from({ length: sorted.length }, () => 1);
  let clusterEnd = 0;
  let clusterMaxLane = 0;
  let clusterStart = 0;

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.startMinutes >= clusterEnd) {
      // Flush previous cluster
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
  // Flush last cluster
  const count = clusterMaxLane + 1;
  for (let j = clusterStart; j < sorted.length; j++) laneCount[j] = count;

  return sorted.map((event, i) => ({
    event,
    laneIndex: laneIndices[i],
    laneCount: laneCount[i],
  }));
}

/** Hour labels to render on the time axis (one per hour, 08:00–22:00). */
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

/** Half-hour line positions (08:30, 09:30, ..., 21:30). */
export const HALF_HOUR_PERCENTS: number[] = Array.from({ length: 14 }, (_, i) =>
  minutesToPercent(CAL_START_MINUTES + i * 60 + 30),
);
