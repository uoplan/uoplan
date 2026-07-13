/**
 * Central, pure web export contract for schedule `.ics` downloads.
 *
 * This module owns the boundary between "here is a schedule (or several,
 * across terms) the student wants to export" and the actual `@uoplan/ics`
 * (`@uoplan/core`) rendering call. It resolves opt-in important-date
 * enrichment (mandatory `no_classes`/`schedule_replacement` closures plus
 * optional `deadline` rows) against a caller-supplied `ImportantDatesData`
 * asset and fails loudly — before any ICS bytes are produced — if a segment
 * can't be matched to exactly one canonical term.
 *
 * Deliberately dependency-free of React, analytics, locale APIs, and browser
 * download mechanics: given a request, it returns `{ics, filename, scope}`
 * and lets the caller own the actual `downloadTextFile` + analytics step.
 * Callers building requests: see `lib/graphPlanner/downloadPlannerIcs.ts` for
 * the degree-planner's segment builders.
 */
import type { DataCache, GeneratedSchedule } from "@uoplan/core";
import {
  buildCombinedScheduleIcs,
  buildScheduleIcs,
  ImportantDatesExportError,
} from "@uoplan/core";
import type { ImportantDatesData, ImportantDateTerm } from "@uoplan/core/dataTypes";

/** Whether an export covers one term or the student's whole multi-term plan. */
export type ScheduleExportScope = "single" | "all";

/** One term's schedule plus its own exact recurrence window, keyed by canonical term id. */
export interface ScheduleExportSegment {
  /** Canonical PeopleSoft term id — the same identity as `ImportantDateTerm.termId`. */
  readonly key: string;
  readonly schedule: GeneratedSchedule;
  readonly startDate: string;
  readonly endDate: string;
}

/**
 * A fully-resolved, deterministic description of the `.ics` export the caller
 * wants. Built by request-builders (e.g. `lib/graphPlanner/downloadPlannerIcs.ts`)
 * and consumed here — never constructed or mutated by this module.
 */
export interface ScheduleExportRequest {
  readonly scope: ScheduleExportScope;
  /**
   * Non-empty. `scope: "single"` requires exactly one segment and renders via
   * `buildScheduleIcs`. `scope: "all"` requires one or more segments and
   * always renders via `buildCombinedScheduleIcs` — even for a single
   * segment, so its UID stays consistently key-prefixed regardless of how
   * many terms ended up downloadable.
   */
  readonly segments: readonly ScheduleExportSegment[];
  readonly cache: DataCache | null;
  /** Precomputed by the caller so existing filenames are preserved exactly. */
  readonly filename: string;
}

/** Opt-in important-date enrichment shared by single and combined exports. */
export interface ScheduleExportImportantDatesOptions {
  readonly data: ImportantDatesData;
  readonly includeDeadlines: boolean;
}

export interface ResolvedScheduleExport {
  readonly ics: string;
  readonly filename: string;
  readonly scope: ScheduleExportScope;
}

function fail(message: string): never {
  throw new ImportantDatesExportError(message, "missing-term");
}

/**
 * Resolves every segment to exactly one {@link ImportantDateTerm}, matched by
 * canonical `termId` equality only (never by label or date range — the
 * current important-dates dataset always tags every term with a canonical
 * `termId`, so no fallback is implemented; a term lacking one simply can
 * never match, the same as any other unmatched segment).
 *
 * Throws a typed {@link ImportantDatesExportError} (`"missing-term"`) before
 * any ICS generation when a segment has:
 *  - no matching term,
 *  - an ambiguous match (more than one term shares that `termId` — a source
 *    data bug), or
 *  - a duplicate segment key in the input (two segments claiming the same
 *    term identity, which would silently collapse to one enrichment).
 *
 * Pure: does not read the clock, locale, or any global state.
 */
export function resolveImportantDateTermsForSegments(
  segments: readonly ScheduleExportSegment[],
  data: ImportantDatesData,
): ReadonlyMap<string, ImportantDateTerm> {
  const resolved = new Map<string, ImportantDateTerm>();

  for (const segment of segments) {
    if (resolved.has(segment.key)) {
      fail(
        `Duplicate export segment for term "${segment.key}": each term must be exported exactly once`,
      );
    }

    const matches = data.terms.filter((term) => term.termId === segment.key);
    if (matches.length === 0) {
      fail(`No important-date term matches term "${segment.key}" (locale: ${data.locale})`);
    }
    if (matches.length > 1) {
      fail(
        `Ambiguous important-date term match for term "${segment.key}": ${matches.length} terms share this termId`,
      );
    }

    resolved.set(segment.key, matches[0]);
  }

  return resolved;
}

/** Guards general request shape, independent of whether important dates are involved. */
function assertWellFormedRequest(request: ScheduleExportRequest): void {
  if (request.segments.length === 0) {
    throw new Error("Schedule export request must include at least one segment");
  }

  const seen = new Set<string>();
  for (const segment of request.segments) {
    if (seen.has(segment.key)) {
      throw new Error(
        `Schedule export request has duplicate segment key "${segment.key}": each term must appear exactly once`,
      );
    }
    seen.add(segment.key);
  }

  if (request.scope === "single" && request.segments.length !== 1) {
    throw new Error(
      `Schedule export request has scope "single" but ${request.segments.length} segments: exactly one segment is required`,
    );
  }
}

function requireResolvedTerm(
  termsByKey: ReadonlyMap<string, ImportantDateTerm>,
  key: string,
): ImportantDateTerm {
  const term = termsByKey.get(key);
  if (!term) {
    // Unreachable in practice: resolveImportantDateTermsForSegments guarantees
    // an entry for every segment key, or throws before returning.
    fail(`No important-date term matches term "${key}"`);
  }
  return term;
}

/**
 * Builds the final `.ics` export for a request, dispatching on
 * `request.scope` — never on segment count: `"single"` always calls
 * `buildScheduleIcs` (exactly one segment, enforced by
 * {@link assertWellFormedRequest}), `"all"` always calls
 * `buildCombinedScheduleIcs`, even when it happens to contain only one
 * segment (so its UID stays key-prefixed, matching the legacy
 * `downloadAllTermsIcs` behavior every "all terms" caller still relies on).
 * Each segment keeps its own recurrence window either way. When
 * `importantDates` is supplied, every segment is resolved to its matching
 * term first (see {@link resolveImportantDateTermsForSegments}); the
 * enrichment is never applied partially or skipped silently — a resolution
 * failure throws before any ICS is generated.
 *
 * Pure: no I/O, no download, no analytics. Callers own `downloadTextFile` and
 * any success/failure tracking.
 */
export function buildScheduleExport(
  request: ScheduleExportRequest,
  importantDates?: ScheduleExportImportantDatesOptions,
): ResolvedScheduleExport {
  assertWellFormedRequest(request);

  const termsByKey = importantDates
    ? resolveImportantDateTermsForSegments(request.segments, importantDates.data)
    : null;

  const ics =
    request.scope === "single"
      ? buildScheduleIcs({
          schedule: request.segments[0].schedule,
          cache: request.cache,
          startDate: request.segments[0].startDate,
          endDate: request.segments[0].endDate,
          importantDates:
            termsByKey && importantDates
              ? {
                  term: requireResolvedTerm(termsByKey, request.segments[0].key),
                  includeDeadlines: importantDates.includeDeadlines,
                }
              : undefined,
        })
      : buildCombinedScheduleIcs({
          segments: request.segments.map(({ key, schedule, startDate, endDate }) => ({
            key,
            schedule,
            startDate,
            endDate,
          })),
          cache: request.cache,
          importantDates:
            termsByKey && importantDates
              ? {
                  termsByKey: Object.fromEntries(termsByKey),
                  includeDeadlines: importantDates.includeDeadlines,
                }
              : undefined,
        });

  return { ics, filename: request.filename, scope: request.scope };
}
