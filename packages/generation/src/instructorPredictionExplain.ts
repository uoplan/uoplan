import type {
  ComponentSection,
  CourseGradesSection,
  CourseSchedule,
  DayOfWeekCode,
  PredictedInstructor,
} from "@uoplan/domain/dataTypes";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import { decodeTermMeta } from "@uoplan/grades/gradeTrends";
import { normalizeInstructorName } from "@uoplan/grades/gradeLookup";
import { isUnknownInstructorName } from "./instructorPrediction";

/**
 * Runtime explanation of *why* the historical instructors of a course are NOT
 * the build-time prediction for one of its unassigned ("Staff") sections.
 *
 * The build-time predictor (`apps/scraper/src/schedules/predictInstructors.ts`)
 * draws candidates from everyone who has taught the course, then drops them in a
 * fixed order: too old (recency window) → already busy at the section's time in
 * the target term → not teaching that term while someone who is got predicted →
 * ranked below the guess cap. This module reproduces that ordering at runtime
 * from data the apps already hold (the target-term schedule + grades history)
 * and reports, per excluded instructor, the reason they were dropped.
 *
 * Informational only — like the prediction itself, the result never feeds grade
 * lookups, professor-rating filters, or the generation engine. The historical
 * pool is grades-based, so (unlike the build-time predictor) it does not include
 * the rare schedule-file-only candidate that never appears in grades.json.
 */

/** Default recency window in years (mirrors the scraper's `DEFAULT_RECENCY_YEARS`). */
const DEFAULT_RECENCY_YEARS = 8;

export type UnpredictedReason =
  /** Teaching another section at an overlapping time in the target term. */
  | {
      kind: "conflict";
      courseCode: NormalizedCourseCode;
      component: string | null;
      section: string;
      day: DayOfWeekCode;
      startMinutes: number;
      endMinutes: number;
    }
  /** Last taught the course before the recency window (stale candidate). */
  | { kind: "stale"; lastYear: number }
  /** Not teaching anything in the target term while an active candidate exists. */
  | { kind: "inactive" }
  /** Recent and non-conflicting, but ranked below the prediction cap. */
  | { kind: "lowerPriority"; lastYear: number };

export interface UnpredictedInstructor {
  name: string;
  legacyId?: number;
  professorRef?: number;
  /** Most recent year this instructor taught THIS course (0 if unknown). */
  lastYear: number;
  reason: UnpredictedReason;
}

export interface ExplainUnpredictedArgs {
  /** Normalized code of the course whose unassigned section is being explained. */
  courseCode: NormalizedCourseCode;
  /** The unassigned ("Staff") section the predictions belong to. */
  section: ComponentSection;
  /** Every course offered in the target term (the loaded schedules file). */
  termSchedules: CourseSchedule[];
  /** Target-term id (PeopleSoft STRM), used for the year + recency window. */
  termId: number;
  /** Historical instructors of THIS course, from grades.pb. */
  courseGrades: CourseGradesSection[];
  /** Instructors already shown as the prediction (excluded from the result). */
  predicted: PredictedInstructor[];
  /** Recency window in years (defaults to 8, matching the scraper). */
  recencyYears?: number;
  /** Cap on the number of explanations returned (defaults to unlimited). */
  maxReasons?: number;
}

interface BusyInterval {
  courseCode: NormalizedCourseCode;
  component: string | null;
  section: string;
  day: DayOfWeekCode;
  start: number;
  end: number;
}

interface PoolEntry {
  norm: string;
  display: string;
  legacyId?: number;
  professorRef?: number;
  lastYear: number;
}

function slotsOf(
  section: ComponentSection,
): Array<{ day: DayOfWeekCode; start: number; end: number }> {
  const slots: Array<{ day: DayOfWeekCode; start: number; end: number }> = [];
  for (const time of section.times) {
    if (time.endMinutes > time.startMinutes) {
      slots.push({ day: time.day, start: time.startMinutes, end: time.endMinutes });
    }
  }
  return slots;
}

/**
 * Index the target term: for every known instructor, the meeting intervals they
 * teach (tagged with the owning section) plus the set of instructors active in
 * the term at all (even those without parseable meeting times).
 */
function indexTerm(termSchedules: CourseSchedule[]): {
  busy: Map<string, BusyInterval[]>;
  active: Set<string>;
} {
  const busy = new Map<string, BusyInterval[]>();
  const active = new Set<string>();
  for (const course of termSchedules) {
    for (const [component, sections] of Object.entries(course.components)) {
      for (const section of sections) {
        for (const time of section.times) {
          const name = typeof time.instructor === "string" ? time.instructor.trim() : "";
          if (!name || isUnknownInstructorName(name)) continue;
          const norm = normalizeInstructorName(name);
          active.add(norm);
          if (time.endMinutes <= time.startMinutes) continue;
          const interval: BusyInterval = {
            courseCode: course.courseCode,
            component,
            section: section.sectionCode ?? section.section,
            day: time.day,
            start: time.startMinutes,
            end: time.endMinutes,
          };
          const list = busy.get(norm);
          if (list) list.push(interval);
          else busy.set(norm, [interval]);
        }
      }
    }
  }
  return { busy, active };
}

/**
 * Build the per-course pool of historical instructors from grades rows: one
 * entry per distinct (normalized) name, carrying the best display name and the
 * most recent year they taught the course.
 */
function buildPool(courseGrades: CourseGradesSection[]): Map<string, PoolEntry> {
  const pool = new Map<string, PoolEntry>();
  for (const row of courseGrades) {
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name || isUnknownInstructorName(name)) continue;
    const norm = normalizeInstructorName(name);
    const year = decodeTermMeta(Number(row.termId ?? 0)).year;
    const existing = pool.get(norm);
    if (!existing) {
      pool.set(norm, {
        norm,
        display: name,
        legacyId: row.legacyId,
        professorRef: row.professorRef,
        lastYear: year,
      });
      continue;
    }
    if (existing.legacyId == null && row.legacyId != null) existing.legacyId = row.legacyId;
    if (existing.professorRef == null && row.professorRef != null) {
      existing.professorRef = row.professorRef;
    }
    if (year > existing.lastYear) existing.lastYear = year;
  }
  return pool;
}

function overlaps(
  interval: BusyInterval,
  slot: { day: DayOfWeekCode; start: number; end: number },
): boolean {
  return interval.day === slot.day && interval.start < slot.end && slot.start < interval.end;
}

const REASON_RANK: Record<UnpredictedReason["kind"], number> = {
  conflict: 0,
  inactive: 1,
  stale: 2,
  lowerPriority: 3,
};

/** Pre-built, course-independent term/grades context shared across sections. */
interface ClassifyContext {
  busy: Map<string, BusyInterval[]>;
  active: Set<string>;
  pool: Map<string, PoolEntry>;
  predictedSet: Set<string>;
  minYear: number;
  targetYear: number;
}

/** Normalized set of the predicted instructors' names (excluded from results). */
function buildPredictedSet(predicted: PredictedInstructor[]): Set<string> {
  return new Set<string>(
    predicted
      .map((p) => (typeof p.name === "string" ? p.name.trim() : ""))
      .filter((name) => name.length > 0 && !isUnknownInstructorName(name))
      .map((name) => normalizeInstructorName(name)),
  );
}

/**
 * Classify every non-predicted historical instructor against a single unassigned
 * section, reproducing the build-time predictor's drop order (recency → time
 * conflict → active/inactive tier → cap). Pure over the shared `ctx`.
 */
function classifyForSection(
  section: ComponentSection,
  ctx: ClassifyContext,
): UnpredictedInstructor[] {
  const { busy, active, pool, predictedSet, minYear, targetYear } = ctx;
  const slots = slotsOf(section);

  const isRecent = (entry: PoolEntry) => entry.lastYear >= minYear && entry.lastYear <= targetYear;

  const conflictOf = (entry: PoolEntry): BusyInterval | undefined => {
    const intervals = busy.get(entry.norm);
    if (!intervals || slots.length === 0) return undefined;
    return intervals.find((interval) => slots.some((slot) => overlaps(interval, slot)));
  };

  // Whether any plausible candidate (recent + non-conflicting) is active in the
  // term — including the prof that actually got predicted. This mirrors the
  // predictor's tier-1 "prefer active candidates" gate: it is the only situation
  // in which a recent, non-conflicting, inactive prof is dropped (rather than
  // surfacing via the tier-2 fallback).
  let anyActiveCandidate = false;
  for (const entry of pool.values()) {
    if (!isRecent(entry) || conflictOf(entry)) continue;
    if (active.has(entry.norm)) {
      anyActiveCandidate = true;
      break;
    }
  }

  const result: UnpredictedInstructor[] = [];
  for (const entry of pool.values()) {
    if (predictedSet.has(entry.norm)) continue;

    const base = {
      name: entry.display,
      ...(entry.legacyId != null ? { legacyId: entry.legacyId } : {}),
      ...(entry.professorRef != null ? { professorRef: entry.professorRef } : {}),
      lastYear: entry.lastYear,
    };

    // 1. Outside the recency window → stale (the predictor drops these first).
    if (!isRecent(entry)) {
      result.push({ ...base, reason: { kind: "stale", lastYear: entry.lastYear } });
      continue;
    }

    // 2. Busy at an overlapping time in the target term → conflict.
    const conflict = conflictOf(entry);
    if (conflict) {
      result.push({
        ...base,
        reason: {
          kind: "conflict",
          courseCode: conflict.courseCode,
          component: conflict.component,
          section: conflict.section,
          day: conflict.day,
          startMinutes: conflict.start,
          endMinutes: conflict.end,
        },
      });
      continue;
    }

    // 3. Not active this term while an active candidate exists → inactive.
    if (!active.has(entry.norm) && anyActiveCandidate) {
      result.push({ ...base, reason: { kind: "inactive" } });
      continue;
    }

    // 4. Recent, non-conflicting, but ranked below the guess cap.
    result.push({ ...base, reason: { kind: "lowerPriority", lastYear: entry.lastYear } });
  }

  return result;
}

/** Order by reason (conflict → inactive → stale → lower-priority), recency, name. */
function sortAndCap(
  result: UnpredictedInstructor[],
  maxReasons: number | undefined,
): UnpredictedInstructor[] {
  result.sort(
    (a, b) =>
      REASON_RANK[a.reason.kind] - REASON_RANK[b.reason.kind] ||
      b.lastYear - a.lastYear ||
      a.name.localeCompare(b.name),
  );
  return typeof maxReasons === "number" ? result.slice(0, maxReasons) : result;
}

/**
 * For each professor who has historically taught the course but is NOT in the
 * section's prediction list, classify why the build-time predictor would have
 * dropped them. Results are ordered by reason (conflict → inactive → stale →
 * lower-priority), then most-recent year, then name.
 */
export function explainUnpredictedInstructors(
  args: ExplainUnpredictedArgs,
): UnpredictedInstructor[] {
  const recencyYears = args.recencyYears ?? DEFAULT_RECENCY_YEARS;
  const targetYear = decodeTermMeta(Number(args.termId ?? 0)).year;
  if (!targetYear) return [];

  const ctx: ClassifyContext = {
    ...indexTerm(args.termSchedules),
    pool: buildPool(args.courseGrades),
    predictedSet: buildPredictedSet(args.predicted),
    minYear: targetYear - recencyYears,
    targetYear,
  };

  return sortAndCap(classifyForSection(args.section, ctx), args.maxReasons);
}

export interface ExplainUnpredictedForCourseArgs {
  /** Normalized code of the course being explained. */
  courseCode: NormalizedCourseCode;
  /** The course's entry in the target-term schedule (its sections). */
  course: CourseSchedule;
  /** Every course offered in the target term (the loaded schedules file). */
  termSchedules: CourseSchedule[];
  /** Target-term id (PeopleSoft STRM), used for the year + recency window. */
  termId: number;
  /** Historical instructors of the course, from grades.pb. */
  courseGrades: CourseGradesSection[];
  /** Recency window in years (defaults to 8, matching the scraper). */
  recencyYears?: number;
  /** Cap on the number of explanations returned (defaults to unlimited). */
  maxReasons?: number;
}

/** Identity key for de-duplicating one instructor across the course's sections. */
function instructorKey(i: UnpredictedInstructor): string {
  if (i.professorRef != null) return `ref:${i.professorRef}`;
  if (i.legacyId != null) return `id:${i.legacyId}`;
  return `name:${normalizeInstructorName(i.name)}`;
}

/**
 * Course/term-level variant: explain why each historical instructor isn't a
 * prediction for ANY of the course's unassigned sections this term. Predictions
 * are unioned across sections (so a prof predicted for one section is never shown
 * as excluded), and each excluded prof keeps their least-blocking reason — a prof
 * who time-conflicts with one section but could fill another was dropped by the
 * cap (lower-priority), not a hard conflict.
 *
 * Used where only course/term context is available (e.g. the Explore course-page
 * "predicted" badge), rather than a single selected section.
 */
export function explainUnpredictedInstructorsForCourse(
  args: ExplainUnpredictedForCourseArgs,
): UnpredictedInstructor[] {
  const recencyYears = args.recencyYears ?? DEFAULT_RECENCY_YEARS;
  const targetYear = decodeTermMeta(Number(args.termId ?? 0)).year;
  if (!targetYear) return [];

  const sections: ComponentSection[] = [];
  const predictedUnion: PredictedInstructor[] = [];
  for (const list of Object.values(args.course.components)) {
    for (const section of list) {
      const predicted = section.predictedInstructors ?? [];
      if (predicted.length === 0) continue;
      sections.push(section);
      predictedUnion.push(...predicted);
    }
  }
  if (sections.length === 0) return [];

  const ctx: ClassifyContext = {
    ...indexTerm(args.termSchedules),
    pool: buildPool(args.courseGrades),
    predictedSet: buildPredictedSet(predictedUnion),
    minYear: targetYear - recencyYears,
    targetYear,
  };

  // Merge per-section classifications: keep the least-blocking reason per prof
  // (largest rank wins — lowerPriority over a single-section conflict).
  const merged = new Map<string, UnpredictedInstructor>();
  for (const section of sections) {
    for (const item of classifyForSection(section, ctx)) {
      const key = instructorKey(item);
      const existing = merged.get(key);
      if (!existing || REASON_RANK[item.reason.kind] > REASON_RANK[existing.reason.kind]) {
        merged.set(key, item);
      }
    }
  }

  return sortAndCap([...merged.values()], args.maxReasons);
}
