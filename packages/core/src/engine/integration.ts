/**
 * Integration helpers that let the existing generation entry points drive the
 * new `engine` engine without changing their public API.
 *
 * The legacy timetabler returned only the FIRST conflict-free section/time
 * arrangement in fixed cartesian order, so a given course set always rendered
 * with identical times. These helpers run the lazy, seeded timetable enumerator
 * instead, so the arrangement varies with the seed — the headline randomness
 * fix — while leaving course *selection* untouched.
 */
import type { DataCache } from "../dataCache";
import type { GeneratedSchedule, GenerationConstraints } from "../generation";
import { createSeededRng } from "../seededRandom";
import { ConstraintPipeline } from "./constraints/pipeline";
import type { Constraint, ConstraintContext } from "./constraints/types";
import {
  overlapConstraint,
  timeWindowConstraint,
  minProfessorRatingConstraint,
  compressedScheduleConstraint,
  maxFirstYearCreditsConstraint,
  blacklistConstraint,
} from "./constraints/builtins";
import { buildTimetableCourse, type TimetableCourse } from "./timetable/lazyCombos";
import { enumerateArrangements } from "./timetable/enumerator";
import { firstSubsetArrangement } from "./timetable/subsetEnumerator";

interface TimetablePipelineOptions {
  /** Include the blacklist as a hard course-scope constraint. */
  readonly applyBlacklist?: boolean;
  readonly blacklistedCourses?: readonly string[];
}

/**
 * Builds the hard-constraint pipeline used while timetabling a fixed course set:
 * overlap, time window, min professor rating, compressed schedule and the
 * first-year credit cap. The blacklist is optional because the legacy advanced
 * selector did not apply it to the general pool (parity), whereas callers that
 * want the leak fixed can opt in.
 */
export function buildTimetablePipeline(
  constraints: GenerationConstraints,
  opts: TimetablePipelineOptions = {},
): ConstraintPipeline {
  const list: Constraint[] = [
    overlapConstraint,
    timeWindowConstraint(constraints),
    minProfessorRatingConstraint(constraints),
    compressedScheduleConstraint(constraints),
    maxFirstYearCreditsConstraint(constraints),
  ];
  if (opts.applyBlacklist) list.push(blacklistConstraint(opts.blacklistedCourses ?? []));
  return new ConstraintPipeline(list);
}

/**
 * Returns the first conflict-free arrangement of a FIXED course set under the
 * given pipeline, with section order seeded by `rng`, or null if the set cannot
 * be timetabled. The course set must already be exactly the set to schedule
 * (the advanced selector pre-chooses precisely `targetCount` courses).
 */
export function firstSeededArrangement(
  courseCodes: readonly string[],
  cache: DataCache,
  pipeline: ConstraintPipeline,
  rng: () => number,
): GeneratedSchedule | null {
  const ctx: ConstraintContext = {
    cache,
    completed: EMPTY_SET,
    prereqEligible: EMPTY_SET,
  };
  const courses: TimetableCourse[] = [];
  for (const code of courseCodes) {
    const tc = buildTimetableCourse(code, cache, pipeline, ctx, rng);
    if (!tc) return null;
    courses.push(tc);
  }
  for (const schedule of enumerateArrangements(courses, pipeline, ctx)) {
    return schedule;
  }
  return null;
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

function scrambleSeed(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return n ^ (n >>> 16);
}

interface TimetableFixedCourseSetOptions extends TimetablePipelineOptions {
  /** Seed driving the section arrangement order (deterministic per seed). */
  readonly seed?: number;
}

/**
 * Public helper that timetables an exact, fixed course set with the new engine:
 * it builds the hard-constraint pipeline and a seeded arrangement RNG, then
 * returns the first conflict-free section/time arrangement, or null if the set
 * cannot be timetabled. Used by the web course-swap flow (basic mode), which
 * already pre-selects every course and just needs one valid arrangement.
 */
export function timetableFixedCourseSet(
  courseCodes: readonly string[],
  cache: DataCache,
  constraints: GenerationConstraints,
  opts: TimetableFixedCourseSetOptions = {},
): GeneratedSchedule | null {
  const pipeline = buildTimetablePipeline(constraints, opts);
  const rng = createSeededRng((scrambleSeed(opts.seed ?? 0) ^ 0x9e3779b9) >>> 0);
  return firstSeededArrangement(courseCodes, cache, pipeline, rng);
}

/**
 * Returns the first seeded conflict-free timetable that forces all `pinned`
 * courses and fills the remaining slots from `optional` (basic mode), or null.
 * The chosen subset varies with the seed (the legacy solver always picked the
 * same subset). `applyBlacklist` defaults true here because basic selection
 * already filters the blacklist, and a uniform course-scope check is harmless.
 */
export function firstSeededSubsetArrangement(
  pinned: readonly string[],
  optional: readonly string[],
  targetCount: number,
  cache: DataCache,
  pipeline: ConstraintPipeline,
  rng: () => number,
): GeneratedSchedule | null {
  const ctx: ConstraintContext = {
    cache,
    completed: EMPTY_SET,
    prereqEligible: EMPTY_SET,
  };
  return firstSubsetArrangement({ pinned, optional, targetCount, cache, pipeline, ctx, rng });
}
