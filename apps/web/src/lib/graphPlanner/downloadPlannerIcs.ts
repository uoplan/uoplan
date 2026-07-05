import type { DataCache } from "@uoplan/core";
import { buildCombinedScheduleIcs, buildScheduleIcs } from "@uoplan/core";
import type { GenerateSchedulesResult } from "../generateSchedulesAction";
import { computeScheduleDateBounds } from "../../hooks/useTimetableDateRange";
import { downloadTextFile } from "../downloadFile";

/** Slugify a term label for use in a download filename. */
function slugify(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "") || "term"
  );
}

/** A planned term's schedule bundle plus the label shown in the planner. */
export interface PlannerTermDownload {
  termId: string;
  label: string;
  bundle: GenerateSchedulesResult | undefined;
}

/**
 * Derive the recurrence window for a term from its own meeting dates. Returns
 * `null` when the schedule has no dated meetings (nothing to anchor a recurring
 * export to).
 */
function termDateRange(bundle: GenerateSchedulesResult | undefined): {
  schedule: NonNullable<GenerateSchedulesResult["currentSchedule"]>;
  start: string;
  end: string;
} | null {
  const schedule = bundle?.currentSchedule;
  if (!schedule) return null;
  const { start, end } = computeScheduleDateBounds(schedule);
  if (!start || !end) return null;
  return { schedule, start, end };
}

/** True when a term has a downloadable (dated) schedule. */
export function canDownloadTerm(bundle?: GenerateSchedulesResult): boolean {
  return termDateRange(bundle) !== null;
}

/**
 * Download a single planned term's timetable as an `.ics` file. No-op (returns
 * `false`) when the term has no dated schedule to export.
 */
export function downloadTermIcs(term: PlannerTermDownload, cache: DataCache | null): boolean {
  const range = termDateRange(term.bundle);
  if (!range) return false;
  const ics = buildScheduleIcs({
    schedule: range.schedule,
    cache,
    startDate: range.start,
    endDate: range.end,
  });
  downloadTextFile(
    `uoplan-${slugify(term.label)}-${range.start}-to-${range.end}.ics`,
    ics,
    "text/calendar;charset=utf-8",
  );
  return true;
}

/**
 * Download every planned term with a dated schedule as one combined `.ics`
 * (each term keeps its own recurrence window). Returns the number of terms
 * included; `0` means nothing was downloadable.
 */
export function downloadAllTermsIcs(terms: PlannerTermDownload[], cache: DataCache | null): number {
  const segments = terms
    .map((term) => {
      const range = termDateRange(term.bundle);
      return range
        ? { key: term.termId, schedule: range.schedule, startDate: range.start, endDate: range.end }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (segments.length === 0) return 0;
  const ics = buildCombinedScheduleIcs({ segments, cache });
  const start = segments.reduce(
    (min, s) => (s.startDate < min ? s.startDate : min),
    segments[0].startDate,
  );
  const end = segments.reduce((max, s) => (s.endDate > max ? s.endDate : max), segments[0].endDate);
  downloadTextFile(`uoplan-plan-${start}-to-${end}.ics`, ics, "text/calendar;charset=utf-8");
  return segments.length;
}
