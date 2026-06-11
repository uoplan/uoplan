/* eslint-disable */

/**
 * Build-time prediction of instructors for sections that have no assigned
 * instructor (every meeting time is "Staff"/blank).
 *
 * A guess is built from professors who have historically taught the course
 * (from grades.json and recent committed schedule files), then filtered to
 * remove implausible candidates:
 *   - recency: the candidate must have taught the course within `recencyYears`
 *     of the target term;
 *   - time-conflict: a candidate already teaching another section in the SAME
 *     target term must not have a slot overlapping the unassigned section.
 *
 * Candidates are then ranked in two tiers to keep guesses both accurate and
 * short. If any candidate is already teaching at least one known section (any
 * course) in the target term ("active"), only those active candidates are
 * used — they are by far the most plausible and the list stays small. Only when
 * NO candidate is active in the term do we fall back to recent historical
 * instructors who aren't scheduled that term, so courses staffed entirely by
 * absent/returning professors still get a guess. Pass `fallbackToInactive:
 * false` to disable the fallback (strict active-only behaviour).
 *
 * Predictions are informational only — they are stored in a separate proto
 * field and never feed grade lookups, professor-rating filters, or the engine.
 *
 * The three pure helpers below (`termYear`, `normalizeInstructorName`,
 * `isUnknownInstructorName`) mirror the canonical implementations in
 * `@uoplan/core` (`decodeTermMeta`, `normalizeInstructorName`,
 * `isUnknownInstructorName`). They are inlined here because the scraper build
 * runs under Node's experimental TS loader, which cannot resolve core's
 * barrel at runtime. `predictInstructors.test.ts` asserts parity with core.
 */

/** Last-two-digits-of-year for a PeopleSoft term id (e.g. 2179 → 2017). */
function termYear(termId: number): number {
  const n = Math.abs(Math.floor(Number(termId)));
  const s = String(n);
  if (s.length !== 4 || s[0] !== "2") return 0;
  const yy = Number.parseInt(s.slice(1, 3), 10);
  return Number.isFinite(yy) ? 2000 + yy : 0;
}

/** Normalize an instructor name: NFD, strip accents, lowercase, collapse spaces. */
function normalizeInstructorName(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const UNKNOWN_INSTRUCTOR_NAMES = new Set(["", "staff", "tba", "to be announced", "tbd"]);

/** Whether a name is a placeholder for "no assigned instructor". */
function isUnknownInstructorName(name: string | null | undefined): boolean {
  if (typeof name !== "string") return true;
  return UNKNOWN_INSTRUCTOR_NAMES.has(normalizeInstructorName(name));
}

interface PredictedInstructor {
  name: string;
  legacyId?: number;
}

/** Minimal shape of a grades.json entry (apps/scraper/data/grades.json). */
export interface GradesCourseInput {
  code?: string;
  professors?: Array<{
    name?: string;
    legacyId?: number | null;
    termId?: number;
  }>;
}

/** Minimal shape of a RateMyProfessors entry (ratemyprofessors.json). */
interface RmpProfessorInput {
  name?: string;
  legacyId?: number | null;
}

interface ScheduleTimeInput {
  day?: string;
  startMinutes?: number;
  endMinutes?: number;
  instructor?: string | null;
}

interface ScheduleSectionInput {
  section?: string;
  component?: string | null;
  times?: ScheduleTimeInput[];
}

interface ScheduleCourseInput {
  courseCode?: string;
  components?: Record<string, ScheduleSectionInput[] | undefined>;
}

function* iterCourseSections(course: ScheduleCourseInput): Generator<ScheduleSectionInput> {
  for (const sections of Object.values(course.components ?? {})) {
    for (const section of sections ?? []) {
      yield section;
    }
  }
}

function* iterCourseInstructorTimes(
  course: ScheduleCourseInput,
): Generator<{ time: ScheduleTimeInput; name: string; norm: string }> {
  for (const section of iterCourseSections(course)) {
    for (const time of section.times ?? []) {
      const name = String(time.instructor ?? "").trim();
      if (!name || isUnknownInstructorName(name)) continue;
      yield { time, name, norm: normalizeInstructorName(name) };
    }
  }
}

export interface ScheduleFileInput {
  termId?: string | number;
  schedules?: ScheduleCourseInput[];
}

const DEFAULT_RECENCY_YEARS = 8;
const DEFAULT_MAX_GUESSES = 4;

interface OfferingRecord {
  norm: string;
  /** Best display name (grades' canonical/accented name preferred). */
  display: string;
  legacyId?: number;
  /** Most recent year this person taught this course. */
  year: number;
  /** From a grades record (canonical name + legacyId). */
  fromGrades: boolean;
}

/** Per-course pool of historical instructors, keyed by normalized name. */
type CoursePool = Map<string, OfferingRecord>;

interface BusyInterval {
  day: string;
  start: number;
  end: number;
}

function sectionKey(courseCode: string, component: string, section: string): string {
  return `${courseCode}\u0000${component}\u0000${section}`;
}

function mergeRecord(pool: CoursePool, rec: OfferingRecord): void {
  const existing = pool.get(rec.norm);
  if (!existing) {
    pool.set(rec.norm, { ...rec });
    return;
  }
  // Prefer a grades-sourced canonical display name + legacyId.
  if (rec.fromGrades && !existing.fromGrades) {
    existing.display = rec.display;
    existing.fromGrades = true;
  }
  if (existing.legacyId == null && rec.legacyId != null) existing.legacyId = rec.legacyId;
  if (rec.year > existing.year) existing.year = rec.year;
}

/**
 * Pre-compute, from grades.json + schedule files + RMP, the per-course pool of
 * historical instructors and a normalized-name → legacyId map. The returned
 * context is independent of any specific target term.
 */
export function buildPredictionContext(args: {
  grades: GradesCourseInput[];
  scheduleFiles: ScheduleFileInput[];
  rmp?: RmpProfessorInput[];
}): PredictionContext {
  const { grades, scheduleFiles, rmp = [] } = args;

  const legacyByName = new Map<string, number>();
  const addLegacy = (name: string | null | undefined, legacyId: number | null | undefined) => {
    if (legacyId == null || !name) return;
    const norm = normalizeInstructorName(name);
    if (!norm || isUnknownInstructorName(name)) return;
    if (!legacyByName.has(norm)) legacyByName.set(norm, legacyId);
  };

  for (const prof of rmp) addLegacy(prof.name, prof.legacyId);

  const pools = new Map<string, CoursePool>();
  const poolFor = (code: string): CoursePool => {
    let p = pools.get(code);
    if (!p) {
      p = new Map();
      pools.set(code, p);
    }
    return p;
  };

  for (const course of grades) {
    const code = String(course.code ?? "").trim();
    if (!code) continue;
    for (const prof of course.professors ?? []) {
      const name = String(prof.name ?? "").trim();
      if (!name || isUnknownInstructorName(name)) continue;
      addLegacy(name, prof.legacyId);
      const year = termYear(Number(prof.termId ?? 0));
      if (!year) continue;
      mergeRecord(poolFor(code), {
        norm: normalizeInstructorName(name),
        display: name,
        legacyId: prof.legacyId ?? undefined,
        year,
        fromGrades: true,
      });
    }
  }

  for (const file of scheduleFiles) {
    const year = termYear(Number(file.termId ?? 0));
    if (!year) continue;
    for (const course of file.schedules ?? []) {
      const code = String(course.courseCode ?? "").trim();
      if (!code) continue;
      for (const { name, norm } of iterCourseInstructorTimes(course)) {
        mergeRecord(poolFor(code), {
          norm,
          display: name,
          legacyId: legacyByName.get(norm),
          year,
          fromGrades: false,
        });
      }
    }
  }

  return { pools, legacyByName };
}

interface PredictionContext {
  pools: Map<string, CoursePool>;
  legacyByName: Map<string, number>;
}

function timesOverlap(a: BusyInterval, day: string, start: number, end: number): boolean {
  return a.day === day && a.start < end && start < a.end;
}

/**
 * Compute predicted instructors for every unassigned section in `targetFile`.
 * Returns a flat map keyed by (courseCode, component, section) → guesses.
 */
export function predictInstructorsForTerm(
  targetFile: ScheduleFileInput,
  context: PredictionContext,
  options: { recencyYears?: number; maxGuesses?: number; fallbackToInactive?: boolean } = {},
): Map<string, PredictedInstructor[]> {
  const recencyYears = options.recencyYears ?? DEFAULT_RECENCY_YEARS;
  const maxGuesses = options.maxGuesses ?? DEFAULT_MAX_GUESSES;
  const fallbackToInactive = options.fallbackToInactive ?? true;
  const targetYear = termYear(Number(targetFile.termId ?? 0));
  const result = new Map<string, PredictedInstructor[]>();
  if (!targetYear) return result;

  // Busy map for the target term: normalized known-instructor name → intervals.
  // `activeInTerm` collects every known instructor in the target term (even those
  // without parseable times) so we can drop candidates absent that term entirely.
  const busy = new Map<string, BusyInterval[]>();
  const activeInTerm = new Set<string>();
  for (const course of targetFile.schedules ?? []) {
    for (const { time, norm } of iterCourseInstructorTimes(course)) {
      activeInTerm.add(norm);
      const day = String(time.day ?? "");
      const start = Number(time.startMinutes ?? 0);
      const end = Number(time.endMinutes ?? 0);
      if (!day || end <= start) continue;
      const list = busy.get(norm);
      if (list) list.push({ day, start, end });
      else busy.set(norm, [{ day, start, end }]);
    }
  }

  const minYear = targetYear - recencyYears;

  for (const course of targetFile.schedules ?? []) {
    const code = String(course.courseCode ?? "").trim();
    if (!code) continue;
    const pool = context.pools.get(code);
    if (!pool || pool.size === 0) continue;

    for (const [component, sections] of Object.entries(course.components ?? {})) {
      for (const section of sections ?? []) {
        const sectionName = String(section.section ?? "");
        // Only predict for sections with NO known instructor.
        const hasKnown = (section.times ?? []).some(
          (t) => !isUnknownInstructorName(String(t.instructor ?? "")),
        );
        if (hasKnown) continue;

        const slots: Array<{ day: string; start: number; end: number }> = [];
        for (const time of section.times ?? []) {
          const day = String(time.day ?? "");
          const start = Number(time.startMinutes ?? 0);
          const end = Number(time.endMinutes ?? 0);
          if (day && end > start) slots.push({ day, start, end });
        }

        const candidates: OfferingRecord[] = [];
        for (const rec of pool.values()) {
          if (rec.year < minYear || rec.year > targetYear) continue;
          const busyIntervals = busy.get(rec.norm);
          if (busyIntervals && slots.length > 0) {
            const conflicts = slots.some((s) =>
              busyIntervals.some((b) => timesOverlap(b, s.day, s.start, s.end)),
            );
            if (conflicts) continue;
          }
          candidates.push(rec);
        }

        if (candidates.length === 0) continue;

        // Tier 1: candidates already teaching something in the target term are
        // the most plausible — prefer them exclusively when any exist. Tier 2:
        // only when nobody is active do we fall back to recent historical
        // instructors (unless the caller disables the fallback).
        const active = candidates.filter((rec) => activeInTerm.has(rec.norm));
        const chosen = active.length > 0 ? active : fallbackToInactive ? candidates : active;

        if (chosen.length === 0) continue;

        chosen.sort((a, b) => b.year - a.year || a.display.localeCompare(b.display));

        const guesses: PredictedInstructor[] = chosen
          .slice(0, maxGuesses)
          .map((c) =>
            c.legacyId != null ? { name: c.display, legacyId: c.legacyId } : { name: c.display },
          );

        result.set(sectionKey(code, component, sectionName), guesses);
      }
    }
  }

  return result;
}

export { sectionKey };

/** Internal pure helpers, exported for parity tests against @uoplan/core. */
export const __predictInstructorsTest = {
  termYear,
  normalizeInstructorName,
  isUnknownInstructorName,
};
