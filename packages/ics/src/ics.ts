import type { DataCache } from "@uoplan/domain/dataCache";
import type { ImportantDateTerm } from "@uoplan/domain/dataTypes";
import type { GeneratedSchedule } from "@uoplan/generation/generation/types";
import {
  applyImportantDateTransforms,
  ImportantDatesExportError,
  importantDateTermToCalendarEvents,
} from "./importantDateTransforms";
import { renderCalendarEvents } from "./render";
import { scheduleToCalendarEvents } from "./scheduleToEvents";

export * from "./model";
export { renderCalendarEvents } from "./render";
export { scheduleToCalendarEvents } from "./scheduleToEvents";
export {
  applyImportantDateTransforms,
  ImportantDatesExportError,
  importantDateTermToCalendarEvents,
} from "./importantDateTransforms";
export type {
  ApplyImportantDateTransformsOptions,
  ImportantDatesExportErrorCode,
} from "./importantDateTransforms";

/** Opt-in important-date enrichment for a single-term ICS export. */
export interface ImportantDatesExportOptions {
  term: ImportantDateTerm;
  includeDeadlines?: boolean;
}

export function buildScheduleIcs(args: {
  schedule: GeneratedSchedule;
  cache: DataCache | null;
  startDate: string;
  endDate: string;
  importantDates?: ImportantDatesExportOptions;
}): string {
  const events = scheduleToCalendarEvents(args);
  if (!args.importantDates) {
    return renderCalendarEvents(events);
  }
  return renderCalendarEvents(
    applyImportantDateTransforms(events, args.importantDates.term, {
      includeDeadlines: args.importantDates.includeDeadlines,
    }),
  );
}

export interface CombinedScheduleSegment {
  schedule: GeneratedSchedule;
  startDate: string;
  endDate: string;
  key: string;
}

/**
 * Opt-in important-date enrichment for a combined multi-segment ICS export.
 * Every segment must have a matching entry in `termsByKey` (looked up by the
 * segment's own `key`) — a segment without one throws a typed
 * {@link ImportantDatesExportError} (`"missing-term"`) rather than silently
 * skipping that segment's mandatory `no_classes`/`schedule_replacement`
 * enrichment.
 */
export interface CombinedImportantDatesOptions {
  termsByKey: Readonly<Record<string, ImportantDateTerm>>;
  includeDeadlines?: boolean;
}

export function buildCombinedScheduleIcs(args: {
  segments: CombinedScheduleSegment[];
  cache: DataCache | null;
  importantDates?: CombinedImportantDatesOptions;
}): string {
  const events = args.segments.flatMap((segment) => {
    const segmentEvents = scheduleToCalendarEvents({
      schedule: segment.schedule,
      cache: args.cache,
      startDate: segment.startDate,
      endDate: segment.endDate,
      uidPrefix: `${segment.key}-`,
    });

    if (!args.importantDates) {
      return segmentEvents;
    }

    const term = args.importantDates.termsByKey[segment.key];
    if (!term) {
      throw new ImportantDatesExportError(
        `Missing important-date term for segment "${segment.key}"`,
        "missing-term",
      );
    }

    return applyImportantDateTransforms(segmentEvents, term, {
      includeDeadlines: args.importantDates.includeDeadlines,
    });
  });

  return renderCalendarEvents(events);
}

/**
 * Builds the standalone "important dates" calendar for a single term (no
 * enrolled schedule involved) — see {@link importantDateTermToCalendarEvents}
 * for the row-selection semantics.
 */
export function buildImportantDatesIcs(term: ImportantDateTerm): string {
  return renderCalendarEvents(importantDateTermToCalendarEvents(term));
}
