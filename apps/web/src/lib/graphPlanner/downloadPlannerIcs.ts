import type { DataCache } from "@uoplan/core";
import type { GenerateSchedulesResult } from "../generateSchedulesAction";
import { computeScheduleDateBounds } from "../../hooks/useTimetableDateRange";
import type { ScheduleExportRequest, ScheduleExportSegment } from "../scheduleExport";

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
 * Build the deterministic export request for a single planned term. Returns
 * `null` when the term has no dated schedule to export (mirrors
 * {@link canDownloadTerm} exactly). Pure — no I/O, no ICS generation; callers
 * pass the result to `buildScheduleExport` (see `lib/scheduleExport.ts`)
 * whenever they're ready to render + download it.
 */
export function buildTermExportRequest(
  term: PlannerTermDownload,
  cache: DataCache | null,
): ScheduleExportRequest | null {
  const range = termDateRange(term.bundle);
  if (!range) return null;

  const segment: ScheduleExportSegment = {
    key: term.termId,
    schedule: range.schedule,
    startDate: range.start,
    endDate: range.end,
  };

  return {
    scope: "single",
    segments: [segment],
    cache,
    filename: `uoplan-${slugify(term.label)}-${range.start}-to-${range.end}.ics`,
  };
}

/**
 * Build the deterministic export request covering every planned term with a
 * dated schedule (each segment keeps its own recurrence window). Returns
 * `null` when no term is downloadable (mirrors the previous `downloadAllTermsIcs`
 * no-op case). Segment order follows the input order — callers already pass
 * terms in chronological order via `enabledTermIds` — and inactive/empty/
 * non-downloadable terms are omitted, each remaining term appearing exactly
 * once. Pure — no I/O, no ICS generation.
 */
export function buildAllTermsExportRequest(
  terms: PlannerTermDownload[],
  cache: DataCache | null,
): ScheduleExportRequest | null {
  const segments: ScheduleExportSegment[] = [];
  for (const term of terms) {
    const range = termDateRange(term.bundle);
    if (!range) continue;
    segments.push({
      key: term.termId,
      schedule: range.schedule,
      startDate: range.start,
      endDate: range.end,
    });
  }
  if (segments.length === 0) return null;

  const start = segments.reduce(
    (min, s) => (s.startDate < min ? s.startDate : min),
    segments[0].startDate,
  );
  const end = segments.reduce((max, s) => (s.endDate > max ? s.endDate : max), segments[0].endDate);

  return {
    scope: "all",
    segments,
    cache,
    filename: `uoplan-plan-${start}-to-${end}.ics`,
  };
}
