import type {
  DayOfWeek,
  ImportantDateGroup,
  ImportantDateInterval,
  ImportantDateItem,
  ImportantDateSection,
  ImportantDateTerm,
  ScheduleReplacement,
} from "@uoplan/domain/dataTypes";
import {
  addIsoDays,
  canonicalizeCalendarEvent,
  compareIsoDates,
  getIsoDayOfWeek,
  isIsoDate,
  nextIsoDateOnOrAfter,
} from "./model";
import type { CalendarEvent, TimedCalendarEvent, WeeklyRecurrence } from "./model";
import { hasWeeklyRecurrence, matchEventToSession } from "./sessionMatching";

const MINUTES_PER_DAY = 24 * 60;
const DAY_CODES: ReadonlySet<string> = new Set(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);

export type ImportantDatesExportErrorCode =
  | "invalid-interval"
  | "invalid-replacement"
  | "missing-term";

/**
 * Typed failure for important-date export operations (both the pure
 * transforms in this module and the `@uoplan/ics` facade). Callers — notably
 * the web layer — can `instanceof`-check this to render a precise message
 * instead of a generic export failure.
 */
export class ImportantDatesExportError extends Error {
  readonly code: ImportantDatesExportErrorCode;

  constructor(message: string, code: ImportantDatesExportErrorCode) {
    super(message);
    this.name = "ImportantDatesExportError";
    this.code = code;
    Object.setPrototypeOf(this, ImportantDatesExportError.prototype);
  }
}

export interface ApplyImportantDateTransformsOptions {
  /** Include a dated `deadline` row exactly once per item as an all-day event. Defaults to `false`. */
  includeDeadlines?: boolean;
}

function fail(message: string, code: ImportantDatesExportErrorCode): never {
  throw new ImportantDatesExportError(message, code);
}

/** Stable per-term identity folded into every derived UID. */
function termIdentity(term: ImportantDateTerm): string {
  return term.sourceId;
}

/** Strips a UID's trailing `@domain` so it can be embedded inside a composite UID without looking doubled-up. */
function stripUidDomain(uid: string): string {
  const at = uid.indexOf("@");
  return at === -1 ? uid : uid.slice(0, at);
}

function noClassesUid(term: ImportantDateTerm, item: ImportantDateItem): string {
  return `${termIdentity(term)}-${item.id}-no-classes@uoplan`;
}

function deadlineUid(term: ImportantDateTerm, item: ImportantDateItem): string {
  return `${termIdentity(term)}-${item.id}-deadline@uoplan`;
}

function informationalUid(term: ImportantDateTerm, item: ImportantDateItem): string {
  return `${termIdentity(term)}-${item.id}-informational@uoplan`;
}

function replacementNoticeUid(term: ImportantDateTerm, item: ImportantDateItem): string {
  return `${termIdentity(term)}-${item.id}-notice@uoplan`;
}

function replacementCopyUid(
  term: ImportantDateTerm,
  item: ImportantDateItem,
  sourceEvent: CalendarEvent,
): string {
  return `${termIdentity(term)}-${item.id}-${stripUidDomain(sourceEvent.uid)}-replacement@uoplan`;
}

function buildDescription(
  item: ImportantDateItem,
  section: ImportantDateSection,
  group: ImportantDateGroup,
): string | undefined {
  const parts = [item.dateText, group.label, section.label]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function buildAllDayEvent(args: {
  uid: string;
  summary: string;
  description?: string;
  startDate: string;
  endDate: string;
}): CalendarEvent {
  return canonicalizeCalendarEvent({
    uid: args.uid,
    summary: args.summary,
    description: args.description,
    time: { kind: "all-day", startDate: args.startDate, endDate: args.endDate },
  });
}

// ---- validation ----

function validatedInterval(interval: ImportantDateInterval, label: string): ImportantDateInterval {
  if (!isIsoDate(interval.startDate)) {
    fail(`${label} has an invalid start date: ${interval.startDate}`, "invalid-interval");
  }
  if (!isIsoDate(interval.endDate)) {
    fail(`${label} has an invalid end date: ${interval.endDate}`, "invalid-interval");
  }
  if (compareIsoDates(interval.startDate, interval.endDate) > 0) {
    fail(`${label} end date must be on or after the start date`, "invalid-interval");
  }
  if (
    interval.startMinutes !== undefined &&
    (!Number.isInteger(interval.startMinutes) ||
      interval.startMinutes < 0 ||
      interval.startMinutes >= MINUTES_PER_DAY)
  ) {
    fail(`${label} start minutes must be between 0 and ${MINUTES_PER_DAY - 1}`, "invalid-interval");
  }
  if (
    interval.endMinutes !== undefined &&
    (!Number.isInteger(interval.endMinutes) ||
      interval.endMinutes <= 0 ||
      interval.endMinutes > MINUTES_PER_DAY)
  ) {
    fail(`${label} end minutes must be between 1 and ${MINUTES_PER_DAY}`, "invalid-interval");
  }
  if (
    interval.startDate === interval.endDate &&
    interval.startMinutes !== undefined &&
    interval.endMinutes !== undefined &&
    interval.startMinutes >= interval.endMinutes
  ) {
    fail(
      `${label} end minutes must be after start minutes on a same-day interval`,
      "invalid-interval",
    );
  }
  return interval;
}

function validatedReplacement(
  replacement: ScheduleReplacement,
  label: string,
): ScheduleReplacement {
  if (!isIsoDate(replacement.cancelledDate)) {
    fail(
      `${label} has an invalid cancelled date: ${replacement.cancelledDate}`,
      "invalid-replacement",
    );
  }
  if (!isIsoDate(replacement.replacementDate)) {
    fail(
      `${label} has an invalid replacement date: ${replacement.replacementDate}`,
      "invalid-replacement",
    );
  }
  if (!DAY_CODES.has(replacement.sourceDay)) {
    fail(`${label} has an invalid source day: ${replacement.sourceDay}`, "invalid-replacement");
  }
  if (getIsoDayOfWeek(replacement.cancelledDate) !== replacement.sourceDay) {
    fail(
      `${label} cancelled date ${replacement.cancelledDate} does not fall on the source weekday ${replacement.sourceDay}`,
      "invalid-replacement",
    );
  }
  return replacement;
}

// ---- term traversal ----

interface TermItemContext {
  item: ImportantDateItem;
  section: ImportantDateSection;
  group: ImportantDateGroup;
}

function* iterateTermItems(term: ImportantDateTerm): Generator<TermItemContext> {
  for (const section of term.sections) {
    for (const group of section.groups) {
      for (const item of group.items) {
        yield { item, section, group };
      }
    }
  }
}

// ---- no_classes closure math ----

/** The inclusive [start, end) minute window during which `date` is closed by `interval`. */
function closureWindowForDate(
  interval: ImportantDateInterval,
  date: string,
): { start: number; end: number } {
  const start = date === interval.startDate ? (interval.startMinutes ?? 0) : 0;
  const end =
    date === interval.endDate ? (interval.endMinutes ?? MINUTES_PER_DAY) : MINUTES_PER_DAY;
  return { start, end };
}

function minutesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Every ISO date matching `day` within the inclusive [startDate, endDate] range, stepping weekly. */
function datesMatchingWeekday(startDate: string, endDate: string, day: DayOfWeek): string[] {
  if (compareIsoDates(startDate, endDate) > 0) return [];
  const dates: string[] = [];
  let current = nextIsoDateOnOrAfter(startDate, day);
  while (compareIsoDates(current, endDate) <= 0) {
    dates.push(current);
    current = addIsoDays(current, 7);
  }
  return dates;
}

function noClassesExclusionsForEvent(
  event: TimedCalendarEvent & { recurrence: WeeklyRecurrence },
  interval: ImportantDateInterval,
): string[] {
  const overlapStart =
    compareIsoDates(event.time.date, interval.startDate) > 0 ? event.time.date : interval.startDate;
  const overlapEnd =
    compareIsoDates(event.recurrence.untilDate, interval.endDate) < 0
      ? event.recurrence.untilDate
      : interval.endDate;
  if (compareIsoDates(overlapStart, overlapEnd) > 0) return [];

  const excluded: string[] = [];
  for (const date of datesMatchingWeekday(overlapStart, overlapEnd, event.recurrence.day)) {
    const window = closureWindowForDate(interval, date);
    if (minutesOverlap(event.time.startMinutes, event.time.endMinutes, window.start, window.end)) {
      excluded.push(date);
    }
  }
  return excluded;
}

// ---- schedule_replacement math ----

function scheduleReplacementExclusionsForEvent(
  event: TimedCalendarEvent & { recurrence: WeeklyRecurrence },
  replacement: ScheduleReplacement,
): string[] {
  const excluded: string[] = [];
  for (const date of [replacement.cancelledDate, replacement.replacementDate]) {
    const withinBounds =
      compareIsoDates(event.time.date, date) <= 0 &&
      compareIsoDates(date, event.recurrence.untilDate) <= 0;
    if (withinBounds && getIsoDayOfWeek(date) === event.recurrence.day) {
      excluded.push(date);
    }
  }
  return excluded;
}

function buildReplacementCopies(
  events: readonly CalendarEvent[],
  item: ImportantDateItem,
  replacement: ScheduleReplacement,
  term: ImportantDateTerm,
): CalendarEvent[] {
  const copies: CalendarEvent[] = [];
  for (const event of events) {
    if (!hasWeeklyRecurrence(event)) continue;
    if (event.recurrence.day !== replacement.sourceDay) continue;

    const withinOriginalBounds =
      compareIsoDates(replacement.cancelledDate, event.time.date) >= 0 &&
      compareIsoDates(replacement.cancelledDate, event.recurrence.untilDate) <= 0;
    if (!withinOriginalBounds) continue;
    if (event.recurrence.excludedDates.includes(replacement.cancelledDate)) continue;

    copies.push(
      canonicalizeCalendarEvent({
        uid: replacementCopyUid(term, item, event),
        summary: event.summary,
        description: event.description,
        location: event.location,
        time: {
          kind: "timed",
          date: replacement.replacementDate,
          startMinutes: event.time.startMinutes,
          endMinutes: event.time.endMinutes,
          timeZone: event.time.timeZone,
        },
      }),
    );
  }
  return copies;
}

/**
 * Applies the mandatory (`no_classes`, `schedule_replacement`) and optional
 * (`deadline`, gated by `includeDeadlines`) effects of a single
 * {@link ImportantDateTerm} to a set of schedule {@link CalendarEvent}s.
 *
 * Pure: returns a new, canonical array without mutating `events` or `term`.
 * `structural`, `informational`, and undated rows never alter recurrence and
 * are never added — only `no_classes`/`schedule_replacement` (always) and
 * `deadline` (opt-in) can affect the output. Only the provided `term` is ever
 * consulted, so combining events from several terms never leaks rules across
 * terms — call this once per term/segment.
 */
export function applyImportantDateTransforms(
  events: readonly CalendarEvent[],
  term: ImportantDateTerm,
  options?: ApplyImportantDateTransformsOptions,
): CalendarEvent[] {
  const includeDeadlines = options?.includeDeadlines ?? false;

  // Computed once for the input events (never recomputed per item/group).
  const eventSessionCodes = new Map<string, string | undefined>();
  for (const event of events) {
    eventSessionCodes.set(event.uid, matchEventToSession(event, term.sessions));
  }

  /** All events (unscoped) or only those matched to `sessionCode` (scoped). */
  function eventsInScope(sessionCode: string | undefined): readonly CalendarEvent[] {
    if (sessionCode === undefined) return events;
    return events.filter((event) => eventSessionCodes.get(event.uid) === sessionCode);
  }

  const exclusionAdditions = new Map<string, Set<string>>();
  function addExclusions(event: CalendarEvent, dates: readonly string[]): void {
    if (dates.length === 0) return;
    const set = exclusionAdditions.get(event.uid) ?? new Set<string>();
    for (const date of dates) set.add(date);
    exclusionAdditions.set(event.uid, set);
  }

  const newAllDayEvents: CalendarEvent[] = [];
  const replacementCopies: CalendarEvent[] = [];

  for (const { item, section, group } of iterateTermItems(term)) {
    const isScoped = group.sessionCode !== undefined;
    const scopedEvents = eventsInScope(group.sessionCode);
    // A scoped group whose session has no representation among the source
    // events produces no scoped result at all — no closure/deadline event,
    // no exclusions, no replacement copies. Unscoped groups are never gated.
    const hasScopedResult = !isScoped || scopedEvents.length > 0;

    switch (item.effect) {
      case "no_classes": {
        if (!item.interval) break;
        const interval = validatedInterval(
          item.interval,
          `Important date "${item.id}" no_classes interval`,
        );
        if (!hasScopedResult) break;
        newAllDayEvents.push(
          buildAllDayEvent({
            uid: noClassesUid(term, item),
            summary: item.topic,
            description: buildDescription(item, section, group),
            startDate: interval.startDate,
            endDate: interval.endDate,
          }),
        );
        for (const event of scopedEvents) {
          if (!hasWeeklyRecurrence(event)) continue;
          addExclusions(event, noClassesExclusionsForEvent(event, interval));
        }
        break;
      }
      case "schedule_replacement": {
        if (!item.replacement) break;
        const replacement = validatedReplacement(
          item.replacement,
          `Important date "${item.id}" schedule_replacement`,
        );
        if (!hasScopedResult) break;
        for (const event of scopedEvents) {
          if (!hasWeeklyRecurrence(event)) continue;
          addExclusions(event, scheduleReplacementExclusionsForEvent(event, replacement));
        }
        replacementCopies.push(...buildReplacementCopies(scopedEvents, item, replacement, term));
        break;
      }
      case "deadline": {
        if (!includeDeadlines || !item.interval) break;
        const interval = validatedInterval(
          item.interval,
          `Important date "${item.id}" deadline interval`,
        );
        if (!hasScopedResult) break;
        newAllDayEvents.push(
          buildAllDayEvent({
            uid: deadlineUid(term, item),
            summary: item.topic,
            description: buildDescription(item, section, group),
            startDate: interval.startDate,
            endDate: interval.endDate,
          }),
        );
        break;
      }
      case "structural":
      case "informational":
        break;
    }
  }

  const finalEvents = new Map<string, CalendarEvent>();

  for (const event of events) {
    const additions = exclusionAdditions.get(event.uid);
    if (!additions || additions.size === 0 || !hasWeeklyRecurrence(event)) {
      finalEvents.set(event.uid, event);
      continue;
    }
    finalEvents.set(
      event.uid,
      canonicalizeCalendarEvent({
        ...event,
        recurrence: {
          ...event.recurrence,
          excludedDates: [...event.recurrence.excludedDates, ...additions],
        },
      }),
    );
  }

  for (const event of [...newAllDayEvents, ...replacementCopies]) {
    finalEvents.set(event.uid, event);
  }

  return [...finalEvents.values()].sort((a, b) => a.uid.localeCompare(b.uid));
}

/**
 * Builds the standalone "important dates" calendar for a single term: every
 * dated, non-structural row becomes exactly one all-day event (no course
 * schedule involved). `no_classes`/`deadline`/`informational` rows render
 * over their inclusive interval; `schedule_replacement` rows render as a
 * single-day notice on `replacement.replacementDate`. Undated and
 * `structural` rows are omitted. Pure and deterministic (sorted by UID).
 */
export function importantDateTermToCalendarEvents(term: ImportantDateTerm): CalendarEvent[] {
  const events = new Map<string, CalendarEvent>();

  for (const { item, section, group } of iterateTermItems(term)) {
    switch (item.effect) {
      case "structural":
        continue;
      case "no_classes":
      case "deadline":
      case "informational": {
        if (!item.interval) continue;
        const interval = validatedInterval(
          item.interval,
          `Important date "${item.id}" ${item.effect} interval`,
        );
        const uid =
          item.effect === "no_classes"
            ? noClassesUid(term, item)
            : item.effect === "deadline"
              ? deadlineUid(term, item)
              : informationalUid(term, item);
        const event = buildAllDayEvent({
          uid,
          summary: item.topic,
          description: buildDescription(item, section, group),
          startDate: interval.startDate,
          endDate: interval.endDate,
        });
        events.set(event.uid, event);
        continue;
      }
      case "schedule_replacement": {
        if (!item.replacement) continue;
        const replacement = validatedReplacement(
          item.replacement,
          `Important date "${item.id}" schedule_replacement`,
        );
        const event = buildAllDayEvent({
          uid: replacementNoticeUid(term, item),
          summary: item.topic,
          description: buildDescription(item, section, group),
          startDate: replacement.replacementDate,
          endDate: replacement.replacementDate,
        });
        events.set(event.uid, event);
        continue;
      }
    }
  }

  return [...events.values()].sort((a, b) => a.uid.localeCompare(b.uid));
}
