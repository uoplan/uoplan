/**
 * Pure, dependency-free model for the Important Dates monthly calendar.
 *
 * Turns a term's nested sections/groups/items into flat, dated calendar
 * entries, then lays those entries out into a Monday-first 6-week month
 * grid with stable event "lanes" so multi-day ranges render as continuous
 * bars. No React, no DOM, no host-timezone dependence: all date math below
 * uses UTC-based `Date` calls (`Date.UTC` / `getUTC*`), which are always
 * timezone-independent regardless of where this code runs.
 */

import type { ImportantDateTerm } from "@uoplan/core/dataTypes";

// ── Entries ──────────────────────────────────────────────────────────────

/** Semantic variant used to color/legend an entry. */
export type CalendarVariant = "break" | "schedule-change" | "deadline" | "information";

/** A single flattened, dated row from a term, ready for calendar layout. */
export interface CalendarEntry {
  itemId: string;
  sectionId: string;
  groupId: string;
  /** Stable document order across the whole term (section → group → item). */
  sourceOrder: number;
  topic: string;
  dateText: string;
  /** Inclusive ISO (YYYY-MM-DD) start date. */
  startDate: string;
  /** Inclusive ISO (YYYY-MM-DD) end date. */
  endDate: string;
  variant: CalendarVariant;
}

function variantForEffect(effect: string): CalendarVariant | null {
  switch (effect) {
    case "no_classes":
      return "break";
    case "schedule_replacement":
      return "schedule-change";
    case "deadline":
      return "deadline";
    case "informational":
      return "information";
    case "structural":
    default:
      return null;
  }
}

/**
 * Flattens every dated, non-structural item in a term into calendar entries,
 * in document order (section → group → item). Schedule-replacement items use
 * their `replacement.replacementDate` (the day the class actually runs) when
 * present, otherwise their `interval`. Undated items (no interval, no
 * replacement) and structural rows are omitted entirely.
 */
export function flattenTermToCalendarEntries(term: ImportantDateTerm): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  let sourceOrder = 0;

  for (const section of term.sections) {
    for (const group of section.groups) {
      for (const item of group.items) {
        const variant = variantForEffect(item.effect);
        if (variant === null) continue;

        const dateRange = item.replacement
          ? {
              startDate: item.replacement.replacementDate,
              endDate: item.replacement.replacementDate,
            }
          : item.interval;
        if (!dateRange) continue;

        entries.push({
          itemId: item.id,
          sectionId: section.id,
          groupId: group.id,
          sourceOrder: sourceOrder++,
          topic: item.topic,
          dateText: item.dateText,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          variant,
        });
      }
    }
  }

  return entries;
}

// ── ISO calendar math (UTC-based, host-timezone independent) ────────────

const MS_PER_DAY = 86_400_000;

function parseIsoDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function toEpochDay(date: string): number {
  const { year, month, day } = parseIsoDate(date);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function fromEpochDay(epochDay: number): string {
  const dt = new Date(epochDay * MS_PER_DAY);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addIsoDays(date: string, delta: number): string {
  return fromEpochDay(toEpochDay(date) + delta);
}

/** Monday=0 .. Sunday=6, independent of host timezone (UTC day-of-week). */
function mondayIndexedWeekday(date: string): number {
  const dt = new Date(toEpochDay(date) * MS_PER_DAY);
  const jsDay = dt.getUTCDay(); // Sunday=0 .. Saturday=6
  return (jsDay + 6) % 7;
}

// ── Month resolution ──────────────────────────────────────────────────────

export interface ResolvedMonth {
  year: number;
  /** 1-12 */
  month: number;
}

function containsDate(interval: { startDate: string; endDate: string }, date: string): boolean {
  return interval.startDate <= date && date <= interval.endDate;
}

/** Extracts the resolved `{year, month}` from an ISO (YYYY-MM-DD) date string. */
export function monthOfIsoDate(date: string): ResolvedMonth {
  const { year, month } = parseIsoDate(date);
  return { year, month };
}

/**
 * The month a term's calendar should open on: today's month when today falls
 * inside the term's `termInterval`, otherwise the month of
 * `term.courseInterval.startDate`.
 */
export function resolveInitialMonth(term: ImportantDateTerm, today: string): ResolvedMonth {
  if (containsDate(term.termInterval, today)) {
    return monthOfIsoDate(today);
  }
  return monthOfIsoDate(term.courseInterval.startDate);
}

/** Shifts a resolved month forward/backward by `delta` months (year-wrapping). */
export function shiftMonth(month: ResolvedMonth, delta: number): ResolvedMonth {
  const zeroBased = month.month - 1 + delta;
  const year = month.year + Math.floor(zeroBased / 12);
  const normalizedZeroBased = ((zeroBased % 12) + 12) % 12;
  return { year, month: normalizedZeroBased + 1 };
}

/** Localized "Month Year" label (e.g. "March 2026" / "mars 2026") for a resolved month. */
export function formatMonthLabel(month: ResolvedMonth, locale: string): string {
  const date = new Date(Date.UTC(month.year, month.month - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Localized Monday-first weekday labels (7 entries), e.g. for a calendar header row. */
export function formatWeekdayLabels(
  locale: string,
  format: Intl.DateTimeFormatOptions["weekday"] = "short",
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format, timeZone: "UTC" });
  // 2024-01-01 is a known Monday; any Monday works as a reference date.
  const referenceMonday = Date.UTC(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(referenceMonday + i * MS_PER_DAY)),
  );
}

// ── Month grid + lane layout ──────────────────────────────────────────────

export interface CalendarDay {
  /** ISO (YYYY-MM-DD) date of this cell. */
  date: string;
  dayOfMonth: number;
  /** False for the leading/trailing days from adjacent months. */
  inCurrentMonth: boolean;
  /** Entries active on this day beyond the visible lane cap. */
  hiddenEntries: CalendarEntry[];
}

export type CalendarLaneCell =
  | { kind: "empty"; span: number }
  | {
      kind: "segment";
      span: number;
      entry: CalendarEntry;
      /** True when this segment includes the entry's true (unclipped) start date. */
      isRangeStart: boolean;
      /** True when this segment includes the entry's true (unclipped) end date. */
      isRangeEnd: boolean;
    };

export interface CalendarWeek {
  /** Always 7 entries, Monday first. */
  days: CalendarDay[];
  /** One array per lane actually used this week (0..maxVisibleLanes); each inner array's spans sum to 7. */
  laneRows: CalendarLaneCell[][];
}

export interface CalendarMonth {
  year: number;
  month: number;
  /** Always 6 entries (42 days). */
  weeks: CalendarWeek[];
}

export interface BuildCalendarMonthOptions {
  /** Maximum simultaneous event lanes rendered per day before overflowing to `hiddenEntries`. Default 3. */
  maxVisibleLanes?: number;
}

interface WeekSpan {
  startDate: string;
  endDate: string;
}

interface Segment {
  entry: CalendarEntry;
  weekIndex: number;
  startDayIndex: number; // 0-6 within the week
  endDayIndex: number; // 0-6 within the week
  isRangeStart: boolean;
  isRangeEnd: boolean;
}

/**
 * Builds a Monday-first 6-week grid for `month`, laying out `entries` as
 * continuous multi-day bars split at week boundaries, with stable lane
 * assignment (an entry keeps the same lane across the weeks it spans when
 * that lane stays free) and a per-day overflow list beyond `maxVisibleLanes`.
 */
export function buildCalendarMonth(
  entries: readonly CalendarEntry[],
  month: ResolvedMonth,
  options: BuildCalendarMonthOptions = {},
): CalendarMonth {
  const maxVisibleLanes = options.maxVisibleLanes ?? 3;

  const firstOfMonth = `${month.year}-${String(month.month).padStart(2, "0")}-01`;
  const gridStart = addIsoDays(firstOfMonth, -mondayIndexedWeekday(firstOfMonth));

  const weekSpans: WeekSpan[] = [];
  for (let w = 0; w < 6; w++) {
    const startDate = addIsoDays(gridStart, w * 7);
    weekSpans.push({ startDate, endDate: addIsoDays(startDate, 6) });
  }
  const gridEnd = weekSpans[5]!.endDate;

  // Only lay out entries that overlap the visible grid at all.
  const relevant = entries.filter((e) => e.startDate <= gridEnd && e.endDate >= gridStart);

  // Stable global lane assignment: process longest-first (by true, unclipped
  // range) so multi-week bars claim a lane before shorter same-day items, then
  // by start date, then by source order for determinism.
  const ordered = [...relevant].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    const aLen = toEpochDay(a.endDate) - toEpochDay(a.startDate);
    const bLen = toEpochDay(b.endDate) - toEpochDay(b.startDate);
    if (aLen !== bLen) return bLen - aLen;
    return a.sourceOrder - b.sourceOrder;
  });

  const laneRanges: Array<{ startDate: string; endDate: string }[]> = [];
  const laneByItemId = new Map<string, number>();
  for (const entry of ordered) {
    // Bounded by the number of already-placed entries: at worst every prior
    // entry occupies its own lane, so a free lane always exists by this index.
    const maxLane = laneRanges.length;
    let lane = maxLane;
    for (let candidate = 0; candidate <= maxLane; candidate++) {
      const occupied = laneRanges[candidate] ?? [];
      const overlaps = occupied.some(
        (r) => entry.startDate <= r.endDate && entry.endDate >= r.startDate,
      );
      if (!overlaps) {
        lane = candidate;
        break;
      }
    }
    (laneRanges[lane] ??= []).push({ startDate: entry.startDate, endDate: entry.endDate });
    laneByItemId.set(entry.itemId, lane);
  }

  // Build per-week segments (clipped to that week's span).
  const segmentsByWeek: Segment[][] = weekSpans.map(() => []);
  for (const entry of relevant) {
    for (let w = 0; w < weekSpans.length; w++) {
      const week = weekSpans[w]!;
      const segStart = entry.startDate > week.startDate ? entry.startDate : week.startDate;
      const segEnd = entry.endDate < week.endDate ? entry.endDate : week.endDate;
      if (segStart > segEnd) continue;
      segmentsByWeek[w]!.push({
        entry,
        weekIndex: w,
        startDayIndex: mondayIndexedWeekday(segStart),
        endDayIndex: mondayIndexedWeekday(segEnd),
        isRangeStart: segStart === entry.startDate,
        isRangeEnd: segEnd === entry.endDate,
      });
    }
  }

  // Per-day hidden-entry tracking (active entries beyond maxVisibleLanes).
  const hiddenByDate = new Map<string, CalendarEntry[]>();
  for (const entry of relevant) {
    const lane = laneByItemId.get(entry.itemId)!;
    if (lane < maxVisibleLanes) continue;
    let cursor = entry.startDate > gridStart ? entry.startDate : gridStart;
    const last = entry.endDate < gridEnd ? entry.endDate : gridEnd;
    while (cursor <= last) {
      const list = hiddenByDate.get(cursor) ?? [];
      list.push(entry);
      hiddenByDate.set(cursor, list);
      cursor = addIsoDays(cursor, 1);
    }
  }
  // Keep each day's hidden list in stable document order.
  for (const list of hiddenByDate.values()) {
    list.sort((a, b) => a.sourceOrder - b.sourceOrder);
  }

  const weeks: CalendarWeek[] = weekSpans.map((weekSpan, w) => {
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addIsoDays(weekSpan.startDate, i);
      const { month: dayMonth } = parseIsoDate(date);
      days.push({
        date,
        dayOfMonth: parseIsoDate(date).day,
        inCurrentMonth: dayMonth === month.month,
        hiddenEntries: hiddenByDate.get(date) ?? [],
      });
    }

    const weekSegments = segmentsByWeek[w]!;
    const laneCount = weekSegments.reduce((max, seg) => {
      const lane = laneByItemId.get(seg.entry.itemId)!;
      return lane < maxVisibleLanes ? Math.max(max, lane + 1) : max;
    }, 0);

    const laneRows: CalendarLaneCell[][] = [];
    for (let lane = 0; lane < laneCount; lane++) {
      const laneSegments = weekSegments
        .filter((seg) => laneByItemId.get(seg.entry.itemId) === lane)
        .sort((a, b) => a.startDayIndex - b.startDayIndex);

      const row: CalendarLaneCell[] = [];
      let cursor = 0;
      for (const seg of laneSegments) {
        if (seg.startDayIndex > cursor) {
          row.push({ kind: "empty", span: seg.startDayIndex - cursor });
        }
        row.push({
          kind: "segment",
          span: seg.endDayIndex - seg.startDayIndex + 1,
          entry: seg.entry,
          isRangeStart: seg.isRangeStart,
          isRangeEnd: seg.isRangeEnd,
        });
        cursor = seg.endDayIndex + 1;
      }
      if (cursor < 7) {
        row.push({ kind: "empty", span: 7 - cursor });
      }
      laneRows.push(row);
    }

    return { days, laneRows };
  });

  return { year: month.year, month: month.month, weeks };
}
