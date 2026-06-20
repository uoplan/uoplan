import { mergeBlockedWindows, type BlockedTimeWindow } from "@uoplan/core";
import type { DayOfWeek } from "@uoplan/core/dataTypes";

/**
 * The user-tunable generation options surfaced by the schedule settings sheet —
 * the native basic-mode subset of the web generator's
 * {@link GenerationOptionsFields}. Mirrors `apps/web/src/store/generationDefaults.ts`
 * so a generated native timetable matches what the web app would produce for the
 * same basket + options.
 */
export interface ScheduleOptions {
  /** Earliest a class may start (minutes since midnight). */
  minStartMinutes: number;
  /** Latest a class may end (minutes since midnight). */
  maxEndMinutes: number;
  /** Weekdays kept class-free (mapped to full-day blocked windows). */
  avoidedDays: DayOfWeek[];
  /** Custom blocked windows created by dragging on the native week calendar. */
  blockedTimes: BlockedTimeWindow[];
  /** At most one ≤90-minute gap per day. */
  compressedSchedule: boolean;
  /** Prefer courses with higher historical A+ rates from each pool. */
  preferEasier: boolean;
  /** Prefer courses with better student-feedback ratings from each pool. */
  preferHigherSentiment: boolean;
  /** Minimum RateMyProfessors rating (professors without a rating are always allowed). */
  minProfessorRating: number | null;
  /** Course-level buckets allowed for elective requirement pools. */
  electiveLevelBuckets: number[];
  /** Allow sections that are already full. */
  includeClosedComponents: boolean;
  /** Only sections with a virtual meeting time. */
  virtualSectionsOnly: boolean;
}

// Web parity — see apps/web/src/store/generationDefaults.ts.
export const DEFAULT_GENERATION_MIN_START_MINUTES = 8 * 60 + 30; // 8:30
export const DEFAULT_GENERATION_MAX_END_MINUTES = 22 * 60; // 22:00
export const DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS = [1000, 2000];
/** A day is "avoided" when a blocked window covers this full span. */
const AVOID_DAY_START_MINUTES = 8 * 60 + 30; // 8:30
const AVOID_DAY_END_MINUTES = 22 * 60; // 22:00

export const DEFAULT_SCHEDULE_OPTIONS: ScheduleOptions = {
  minStartMinutes: DEFAULT_GENERATION_MIN_START_MINUTES,
  maxEndMinutes: DEFAULT_GENERATION_MAX_END_MINUTES,
  avoidedDays: ["Sa", "Su"],
  blockedTimes: [],
  compressedSchedule: false,
  preferEasier: false,
  preferHigherSentiment: false,
  minProfessorRating: null,
  electiveLevelBuckets: [...DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS],
  includeClosedComponents: false,
  virtualSectionsOnly: false,
};

const VALID_DAYS: readonly DayOfWeek[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const VALID_ELECTIVE_LEVEL_BUCKETS = new Set([1000, 2000, 3000, 4000, 5000, 6000]);

/**
 * Map avoided weekdays to full-day blocked windows the engine treats as
 * unavailable. Replicates the web `avoidWindowForDay` mapping
 * (`apps/web/src/lib/blockedTimes.ts`).
 */
export function avoidedDaysToBlockedTimes(days: DayOfWeek[]): BlockedTimeWindow[] {
  return days.map((day) => ({
    day,
    startMinutes: AVOID_DAY_START_MINUTES,
    endMinutes: AVOID_DAY_END_MINUTES,
  }));
}

export function blockedTimesForScheduleOptions(options: ScheduleOptions): BlockedTimeWindow[] {
  return mergeBlockedWindows([
    ...avoidedDaysToBlockedTimes(options.avoidedDays),
    ...options.blockedTimes,
  ]);
}

/**
 * Parse persisted options JSON, tolerating any malformed shape: each field falls
 * back to its default independently so a partial / corrupt file still yields a
 * usable {@link ScheduleOptions}.
 */
export function parseScheduleOptions(text: string): ScheduleOptions {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ...DEFAULT_SCHEDULE_OPTIONS };
  }
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SCHEDULE_OPTIONS };
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, d: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : d;
  const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
  const avoidedDays = Array.isArray(o.avoidedDays)
    ? o.avoidedDays.filter(
        (d): d is DayOfWeek => typeof d === "string" && VALID_DAYS.includes(d as DayOfWeek),
      )
    : [...DEFAULT_SCHEDULE_OPTIONS.avoidedDays];
  const blockedTimes = parseBlockedTimes(o.blockedTimes);
  const rating = o.minProfessorRating;
  return {
    minStartMinutes: num(o.minStartMinutes, DEFAULT_SCHEDULE_OPTIONS.minStartMinutes),
    maxEndMinutes: num(o.maxEndMinutes, DEFAULT_SCHEDULE_OPTIONS.maxEndMinutes),
    avoidedDays,
    blockedTimes,
    compressedSchedule: bool(o.compressedSchedule, false),
    preferEasier: bool(o.preferEasier, false),
    preferHigherSentiment: bool(o.preferHigherSentiment, false),
    minProfessorRating: typeof rating === "number" && Number.isFinite(rating) ? rating : null,
    electiveLevelBuckets: parseElectiveLevelBuckets(o.electiveLevelBuckets),
    includeClosedComponents: bool(o.includeClosedComponents, false),
    virtualSectionsOnly: bool(o.virtualSectionsOnly, false),
  };
}

function parseElectiveLevelBuckets(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_SCHEDULE_OPTIONS.electiveLevelBuckets];
  const buckets = new Set<number>();
  for (const raw of value) {
    if (typeof raw === "number" && Number.isFinite(raw) && VALID_ELECTIVE_LEVEL_BUCKETS.has(raw)) {
      buckets.add(raw);
    }
  }
  if (buckets.size === 0) return [...DEFAULT_SCHEDULE_OPTIONS.electiveLevelBuckets];
  return [...buckets].sort((a, b) => a - b);
}

function parseBlockedTimes(value: unknown): BlockedTimeWindow[] {
  if (!Array.isArray(value)) return [];
  const windows: BlockedTimeWindow[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const w = raw as Record<string, unknown>;
    const day = w.day;
    const startMinutes = w.startMinutes;
    const endMinutes = w.endMinutes;
    if (
      typeof day === "string" &&
      VALID_DAYS.includes(day as DayOfWeek) &&
      typeof startMinutes === "number" &&
      Number.isFinite(startMinutes) &&
      typeof endMinutes === "number" &&
      Number.isFinite(endMinutes) &&
      endMinutes > startMinutes
    ) {
      windows.push({ day: day as DayOfWeek, startMinutes, endMinutes });
    }
  }
  return mergeBlockedWindows(windows);
}

/** Serialize options for persistence. */
export function serializeScheduleOptions(options: ScheduleOptions): string {
  return JSON.stringify(options);
}

/** Format minutes-since-midnight as `H:MM AM/PM` for display. */
export function formatTimeLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
