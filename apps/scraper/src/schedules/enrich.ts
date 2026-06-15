/**
 * Enrich schedule JSON with per-section grade `distribution` from grades data
 * (instructor match → course aggregate fallback).
 *
 * The pure matching/aggregation primitives are the single source of truth in
 * `@uoplan/core` (`gradeLookup`); this module keeps only the build-time wrappers
 * that walk the raw scraper JSON. A contract test (`gradeLookupContract.test.ts`)
 * guards that the runtime path reproduces these build-time values.
 */

import {
  accumulateInstructorDistributionByName,
  distributionForSection,
  sumGradeDistributions,
} from "@uoplan/core/gradeLookup";
import type { InstructorNameKey } from "@uoplan/core";

export type GradeDistribution = Record<string, number>;

export interface GradeEnrichmentStats {
  sectionsTotal: number;
  matched: number;
  fallback: number;
  none: number;
}

export interface GradeLookups {
  /** courseCode → termId → normalized instructor name → merged distributions for that term */
  byCourseTermName: Map<string, Map<number, Map<string, GradeDistribution>>>;
  aggregateByCourse: Map<string, GradeDistribution>;
}

/** Top-level JSON written by schedule scraper / consumed by enrich CLI. */
export interface SchedulesFilePayload {
  termId?: string;
  totalCourses?: number;
  totalWithSchedules?: number;
  schedules: ScheduleCourseRow[];
}

/**
 * Minimal row shape the enricher walks. Uses a structural section type so scraper
 * `ComponentSection` (extra fields) assigns without `Record` index-signature issues.
 */
export type ScheduleCourseRow = {
  courseCode?: string;
  components?: Record<string, SectionGradeFields[]>;
};

/** Section fields read/written by enrichment (matches protobuf map keys in build_proto). */
export interface SectionGradeFields {
  times?: Array<{ instructor?: string | null }>;
  distribution?: GradeDistribution;
}

function parseSchedulesTermId(data: { termId?: string | number }): number {
  const parsed = Number.parseInt(String(data.termId ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGradeRowTermId(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function buildGradeLookups(gradesRaw: unknown): GradeLookups {
  const byCourseTermName = new Map<string, Map<number, Map<string, GradeDistribution>>>();
  const aggregateByCourse = new Map<string, GradeDistribution>();

  if (!Array.isArray(gradesRaw)) {
    throw new Error("grades.json: expected top-level array");
  }

  for (const row of gradesRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as { code?: unknown; sections?: unknown; professors?: unknown };
    const code = r.code;
    if (typeof code !== "string" || !code.trim()) continue;
    const sections = Array.isArray(r.sections)
      ? r.sections
      : Array.isArray(r.professors)
        ? r.professors
        : [];

    const allDists: GradeDistribution[] = [];

    for (const p of sections) {
      if (!p || typeof p !== "object") continue;
      const prof = p as { name?: unknown; distribution?: unknown; termId?: unknown };
      const dist = prof.distribution;
      if (!dist || typeof dist !== "object") continue;

      const termId = parseGradeRowTermId(prof.termId);
      if (termId === 0) continue;

      allDists.push(dist as GradeDistribution);

      accumulateInstructorDistributionByName(
        byCourseTermName,
        code,
        termId,
        prof.name,
        dist as GradeDistribution,
      );
    }

    aggregateByCourse.set(code, sumGradeDistributions(allDists));
  }

  return { byCourseTermName, aggregateByCourse };
}

export function enrichSchedulesPayload(
  data: SchedulesFilePayload,
  lookups: GradeLookups,
  stats: GradeEnrichmentStats,
): SchedulesFilePayload {
  const schedules = data.schedules;
  if (!Array.isArray(schedules)) return data;

  const scheduleTermId = parseSchedulesTermId(data);

  for (const course of schedules) {
    if (!course || typeof course !== "object") continue;
    const courseCode = course.courseCode;
    if (typeof courseCode !== "string") continue;

    const termMap = lookups.byCourseTermName.get(courseCode);
    const profMap = scheduleTermId !== 0 ? termMap?.get(scheduleTermId) : undefined;
    const aggregate = lookups.aggregateByCourse.get(courseCode);

    const components = course.components;
    if (!components || typeof components !== "object") continue;

    for (const sections of Object.values(components)) {
      if (!Array.isArray(sections)) continue;
      for (const section of sections) {
        if (!section || typeof section !== "object") continue;
        stats.sectionsTotal += 1;

        const prev = section.distribution;
        delete section.distribution;

        const sectionInstructors = (section.times ?? [])
          .map((t) => t.instructor)
          .filter((i): i is string => typeof i === "string" && i.length > 0);
        const { distribution, kind } = distributionForSection(
          sectionInstructors,
          profMap as Map<InstructorNameKey, GradeDistribution> | undefined,
          aggregate,
        );

        if (distribution && kind !== "none") {
          section.distribution = distribution;
          if (kind === "matched") stats.matched += 1;
          else stats.fallback += 1;
        } else {
          stats.none += 1;
          if (prev !== undefined) {
            /* omit — remove stale data */
          }
        }
      }
    }
  }

  return data;
}

function pct(n: number, d: number): string {
  return d === 0 ? "0.0" : ((100 * n) / d).toFixed(1);
}

export function formatGradeEnrichmentLine(
  label: string,
  stats: Pick<GradeEnrichmentStats, "sectionsTotal" | "matched" | "fallback" | "none">,
): string {
  const { sectionsTotal: s, matched, fallback, none } = stats;
  return (
    `${label}: sections=${s} matched=${matched} (${pct(matched, s)}%) ` +
    `fallback=${fallback} (${pct(fallback, s)}%) ` +
    `noData=${none} (${pct(none, s)}%)`
  );
}
