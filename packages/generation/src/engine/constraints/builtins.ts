/**
 * Built-in {@link Constraint} implementations that reproduce the behaviour of
 * the legacy pipeline's hard filters, expressed in the composable model. Each
 * wraps the already-tested helper it replaces so behaviour stays at parity.
 */
import type { ComponentSection } from "@uoplan/domain/dataTypes";
import type { CourseEnrollment, GenerationConstraints } from "../../generation";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import { enrollmentsOverlap } from "../../generation/overlaps";
import { timeSlotSatisfiesConstraints } from "../../generation/constraints";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import type { Constraint } from "./types";

/** No two enrollments may have overlapping meeting times. Incremental. */
export const overlapConstraint: Constraint = {
  id: "overlap",
  label: "no-overlap",
  active: true,
  allowsEnrollment(candidate: CourseEnrollment, partial: readonly CourseEnrollment[]): boolean {
    for (const e of partial) {
      if (enrollmentsOverlap(e, candidate)) return false;
    }
    return true;
  },
};

/** Section meeting times must fall within allowed days and the time window. */
export function timeWindowConstraint(constraints: GenerationConstraints): Constraint {
  const custom =
    constraints.minStartMinutes > 0 ||
    constraints.maxEndMinutes < 24 * 60 ||
    (constraints.blockedTimes?.length ?? 0) > 0;
  return {
    id: "time-window",
    label: "time-window",
    active: custom,
    allowsSection(_courseCode: string, section: ComponentSection): boolean {
      for (const t of section.times) {
        if (t.startMinutes >= t.endMinutes) continue;
        if (
          !timeSlotSatisfiesConstraints(
            {
              day: t.day,
              startMinutes: t.startMinutes,
              endMinutes: t.endMinutes,
              meetingDates: t.meetingDates ?? null,
            },
            constraints,
          )
        ) {
          return false;
        }
      }
      return true;
    },
  };
}

/** Excludes user-blacklisted courses everywhere (course scope, uniform). */
export function blacklistConstraint(blacklistedCourses: readonly string[]): Constraint {
  const set = new Set<NormalizedCourseCode>(blacklistedCourses.map(normalizeCourseCode));
  return {
    id: "blacklist",
    label: "blacklist",
    active: set.size > 0,
    allowsCourse(courseCode: string): boolean {
      return !set.has(normalizeCourseCode(courseCode));
    },
  };
}

function firstYearCredits(code: string, credits: number | undefined): number {
  const m = code.match(/\d{4}/);
  if (!m || Number(m[0]) >= 2000) return 0;
  return credits ?? 3;
}

/**
 * Caps total first-year (1xxx) credits in a timetable. The legacy solver applied
 * this while picking courses; here the course set is fixed per plan, so it is a
 * whole-timetable check on the (fixed) set's first-year credit sum.
 */
function maxFirstYearCreditsConstraint(constraints: GenerationConstraints): Constraint {
  const cap = constraints.maxFirstYearCredits;
  return {
    id: "max-first-year-credits",
    label: "max-first-year-credits",
    active: cap != null,
    allowsFinalTimetable(enrollments, ctx): boolean {
      if (cap == null) return true;
      let total = 0;
      for (const e of enrollments) {
        total += firstYearCredits(e.courseCode, ctx.cache.getCourse(e.courseCode)?.credits);
        if (total > cap) return false;
      }
      return true;
    },
  };
}

/**
 * Assembles the standard hard-constraint pipeline from the runtime constraints
 * plus the user's blacklist — the same set the legacy solver enforced, now
 * composable and individually relaxable for diagnostics.
 */
export function buildHardConstraintPipeline(
  constraints: GenerationConstraints,
  blacklistedCourses: readonly string[] = [],
): Constraint[] {
  return [
    overlapConstraint,
    timeWindowConstraint(constraints),
    maxFirstYearCreditsConstraint(constraints),
    blacklistConstraint(blacklistedCourses),
  ];
}
