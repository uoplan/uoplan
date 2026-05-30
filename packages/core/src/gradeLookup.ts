import type {
  ComponentSection,
  CourseGradesData,
  GradeDistribution,
  SchedulesData,
} from "./dataTypes";

/**
 * Runtime grade-lookup contract — a direct port of the build-time enrichment in
 * `apps/scraper/src/schedules/enrich.ts` (`buildGradeLookups` +
 * `distributionForSection`). It reproduces, at runtime from `grades.pb`, the
 * per-section grade distribution that was historically baked into
 * `schedules.NNNN.pb`. Keeping a single algorithm here lets the scraper and the
 * app agree byte-for-byte (guarded by a contract test against committed assets).
 *
 * Identity: course code → schedules-file term id → normalized instructor name.
 * Per matched instructor distributions are summed; if ANY instructor matches,
 * there is NO fallback; otherwise the course aggregate (across all professor
 * rows) is used; otherwise the section has no grade data.
 */

export interface GradeLookups {
  /** courseCode → termId → normalized instructor name → merged distribution. */
  byCourseTermName: Map<string, Map<number, Map<string, GradeDistribution>>>;
  /** courseCode → distribution summed across every professor row. */
  aggregateByCourse: Map<string, GradeDistribution>;
}

export type SectionGradeKind = "matched" | "fallback" | "none";

export interface SectionGradeResult {
  distribution?: GradeDistribution;
  kind: SectionGradeKind;
}

/** Normalize an instructor name for matching: NFD, strip accents, lowercase, collapse spaces. */
export function normalizeInstructorName(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Sum grade distributions bucket-by-bucket, ignoring non-finite values. */
export function sumGradeDistributions(
  dists: Array<GradeDistribution | null | undefined>,
): GradeDistribution {
  const out: GradeDistribution = {};
  for (const d of dists) {
    if (!d || typeof d !== "object") continue;
    for (const [k, v] of Object.entries(d)) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

/** True if a distribution has at least one positive bucket. */
export function hasGradeData(dist: GradeDistribution | null | undefined): boolean {
  if (!dist || typeof dist !== "object") return false;
  for (const v of Object.values(dist)) {
    if (Number(v) > 0) return true;
  }
  return false;
}

/**
 * Build the per-course/term/instructor lookup and the per-course aggregate from
 * runtime grades data. Rows with a non-positive term id are skipped (matching
 * the build-time enricher's `termId === 0` guard).
 */
export function buildGradeLookups(grades: CourseGradesData): GradeLookups {
  const byCourseTermName = new Map<string, Map<number, Map<string, GradeDistribution>>>();
  const aggregateByCourse = new Map<string, GradeDistribution>();

  for (const course of grades.courses) {
    const code = course.code;
    if (typeof code !== "string" || !code.trim()) continue;

    const allDists: GradeDistribution[] = [];

    for (const prof of course.professors) {
      const name = prof.name;
      if (typeof name !== "string" || !name.trim()) continue;
      const dist = prof.distribution;
      if (!dist || typeof dist !== "object") continue;

      const termId = Number(prof.termId);
      if (!Number.isFinite(termId) || termId === 0) continue;

      const key = normalizeInstructorName(name);
      if (!key) continue;

      let termMap = byCourseTermName.get(code);
      if (!termMap) {
        termMap = new Map();
        byCourseTermName.set(code, termMap);
      }
      let profMap = termMap.get(termId);
      if (!profMap) {
        profMap = new Map();
        termMap.set(termId, profMap);
      }

      const existing = profMap.get(key);
      profMap.set(key, existing ? sumGradeDistributions([existing, dist]) : { ...dist });
      allDists.push(dist);
    }

    aggregateByCourse.set(code, sumGradeDistributions(allDists));
  }

  return { byCourseTermName, aggregateByCourse };
}

/**
 * Resolve the distribution for a section given its instructor names, the
 * per-instructor map for the relevant course+term, and the course aggregate.
 */
export function distributionForSection(
  instructors: ReadonlyArray<string | null | undefined>,
  profMap: Map<string, GradeDistribution> | undefined,
  courseAggregate: GradeDistribution | undefined,
): SectionGradeResult {
  const matchedParts: GradeDistribution[] = [];
  const seen = new Set<string>();

  for (const raw of instructors) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const norm = normalizeInstructorName(trimmed);
    if (!norm || norm === "staff") continue;
    if (seen.has(norm)) continue;
    seen.add(norm);

    const entry = profMap?.get(norm);
    if (entry && hasGradeData(entry)) {
      matchedParts.push(entry);
    }
  }

  if (matchedParts.length > 0) {
    const merged = sumGradeDistributions(matchedParts);
    if (hasGradeData(merged)) {
      return { distribution: merged, kind: "matched" };
    }
  }

  if (courseAggregate && hasGradeData(courseAggregate)) {
    return { distribution: courseAggregate, kind: "fallback" };
  }

  return { kind: "none" };
}

/**
 * Convenience: resolve a section's distribution directly from {@link GradeLookups}
 * using the course code, the schedules-file term id, and the section instructors.
 */
export function lookupSectionDistribution(
  lookups: GradeLookups,
  courseCode: string,
  termId: number,
  instructors: ReadonlyArray<string | null | undefined>,
): SectionGradeResult {
  const termMap = lookups.byCourseTermName.get(courseCode);
  const profMap = termId !== 0 ? termMap?.get(termId) : undefined;
  const aggregate = lookups.aggregateByCourse.get(courseCode);
  return distributionForSection(instructors, profMap, aggregate);
}

const lookupsByGrades = new WeakMap<CourseGradesData, GradeLookups>();

/**
 * Memoized {@link buildGradeLookups} keyed by the grades object identity. Lets
 * callers (e.g. every term switch) reuse the lookup tables for a given
 * `grades.pb` decode without rebuilding them, while staying free of mutable
 * module singletons (the WeakMap is keyed purely by data identity).
 */
export function getGradeLookups(grades: CourseGradesData): GradeLookups {
  let lookups = lookupsByGrades.get(grades);
  if (!lookups) {
    lookups = buildGradeLookups(grades);
    lookupsByGrades.set(grades, lookups);
  }
  return lookups;
}

/**
 * Runtime equivalent of the build-time `enrichSchedulesPayload`: returns a NEW
 * {@link SchedulesData} whose sections carry the `distribution` resolved from
 * `grades.pb`, reproducing the values historically baked into
 * `schedules.NNNN.pb`. The input is never mutated — course/component/section
 * objects are recreated so a memoized, ungraded decode can't be contaminated.
 *
 * `termId` is the schedules-file term id (e.g. `Number(schedulesData.termId)`),
 * matching the build-time enricher's `parseSchedulesTermId`.
 */
export function enrichSchedulesDataWithGrades(
  data: SchedulesData,
  lookups: GradeLookups,
  termId: number,
): SchedulesData {
  const schedules = data.schedules.map((course) => {
    const termMap = lookups.byCourseTermName.get(course.courseCode);
    const profMap = termId !== 0 ? termMap?.get(termId) : undefined;
    const aggregate = lookups.aggregateByCourse.get(course.courseCode);

    const components: Record<string, ComponentSection[]> = {};
    for (const [component, sections] of Object.entries(course.components)) {
      components[component] = sections.map((section) => {
        const instructors = section.times.map((t) => t.instructor);
        const { distribution, kind } = distributionForSection(instructors, profMap, aggregate);
        const next: ComponentSection = { ...section };
        if (distribution && kind !== "none") {
          next.distribution = distribution;
        } else {
          delete next.distribution;
        }
        return next;
      });
    }

    return { ...course, components };
  });

  return { ...data, schedules };
}
