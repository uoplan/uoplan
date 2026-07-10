/**
 * Seeded subset timetabling: force every pinned course, then pick `targetCount -
 * pinned` of the optional courses and arrange all sections conflict-free,
 * yielding each DISTINCT full timetable.
 *
 * This generalises {@link enumerateArrangements} (which schedules a fixed set)
 * to the case where the course set itself is not fully decided — basic mode
 * chooses which electives to include. Unlike the legacy solver, which re-sorted
 * the optional list by combo count and therefore always chose the SAME subset
 * regardless of seed, the optional courses are visited in a seeded-shuffled
 * order, so different seeds surface different elective subsets *and* different
 * section arrangements.
 */
import type { DataCache } from "@uoplan/domain/dataCache";
import type { CourseEnrollment, GeneratedSchedule } from "../../generation";
import type { ConstraintContext } from "../constraints/types";
import type { ConstraintPipeline } from "../constraints/pipeline";
import { buildTimetableCourse } from "./lazyCombos";
import type { TimetableCourse } from "./lazyCombos";
import { arrangementFingerprint } from "./enumerator";

interface SubsetEnumerationInput {
  readonly pinned: readonly string[];
  readonly optional: readonly string[];
  readonly targetCount: number;
  readonly cache: DataCache;
  readonly pipeline: ConstraintPipeline;
  readonly ctx: ConstraintContext;
  readonly rng: () => number;
  /**
   * Optional cap on the number of section-combo placements explored. Used by the
   * diagnostics to keep the bounded existence check from exploring pathological
   * search spaces. Unbounded (undefined) for real generation.
   */
  readonly maxNodes?: number;
}

/**
 * Yields each distinct conflict-free timetable of exactly `targetCount` courses
 * that includes all pinned courses. Optional courses are considered in seeded
 * order; per-course section combos are seeded upstream. Yields nothing if a
 * pinned course is unschedulable or not enough optional courses fit.
 */
export function* enumerateSubsetTimetables(
  input: SubsetEnumerationInput,
): Generator<GeneratedSchedule> {
  const { pinned, optional, targetCount, cache, pipeline, ctx, rng, maxNodes } = input;
  if (pinned.length > targetCount) return;

  const pinnedCourses: TimetableCourse[] = [];
  for (const code of pinned) {
    const tc = buildTimetableCourse(code, cache, pipeline, ctx, rng);
    if (!tc) return; // a required course cannot be scheduled at all
    pinnedCourses.push(tc);
  }

  // `optional` arrives already ordered by the seeded, soft-weighted selection
  // pass (prefer-easier / immersion). We MUST preserve that order — the legacy
  // solver re-sorted by combo count and so always chose the same subset
  // regardless of seed. Visiting in the given order makes the chosen electives
  // vary with the seed while honouring the soft preferences.
  const optionalCourses: TimetableCourse[] = [];
  for (const code of optional) {
    if (pinned.includes(code)) continue;
    const tc = buildTimetableCourse(code, cache, pipeline, ctx, rng);
    if (tc) optionalCourses.push(tc);
  }

  const chosen: CourseEnrollment[] = [];
  const seen = new Set<string>();
  let nodes = 0;
  const overBudget = () => maxNodes != null && nodes >= maxNodes;

  // Place all pinned courses (every arrangement), then fill remaining slots.
  function* placePinned(idx: number): Generator<GeneratedSchedule> {
    if (idx === pinnedCourses.length) {
      yield* fillOptional(0, targetCount - pinnedCourses.length);
      return;
    }
    for (const combo of pinnedCourses[idx].combos) {
      if (overBudget()) return;
      nodes++;
      if (!pipeline.allowsEnrollment(combo.enrollment, chosen, ctx)) continue;
      chosen.push(combo.enrollment);
      yield* placePinned(idx + 1);
      chosen.pop();
    }
  }

  function* fillOptional(idx: number, slotsLeft: number): Generator<GeneratedSchedule> {
    if (slotsLeft === 0) {
      if (pipeline.allowsFinalTimetable(chosen, ctx)) {
        const fp = arrangementFingerprint({ enrollments: chosen.map((e) => e) });
        if (!seen.has(fp)) {
          seen.add(fp);
          yield { enrollments: chosen.map((e) => e) };
        }
      }
      return;
    }
    if (idx >= optionalCourses.length) return;
    if (optionalCourses.length - idx < slotsLeft) return; // cannot reach target

    // Branch: include optionalCourses[idx] ...
    for (const combo of optionalCourses[idx].combos) {
      if (overBudget()) return;
      nodes++;
      if (!pipeline.allowsEnrollment(combo.enrollment, chosen, ctx)) continue;
      chosen.push(combo.enrollment);
      yield* fillOptional(idx + 1, slotsLeft - 1);
      chosen.pop();
    }
    if (overBudget()) return;
    // ... or skip it.
    yield* fillOptional(idx + 1, slotsLeft);
  }

  yield* placePinned(0);
}

/** First seeded subset timetable, or null if none exists. */
export function firstSubsetArrangement(input: SubsetEnumerationInput): GeneratedSchedule | null {
  for (const schedule of enumerateSubsetTimetables(input)) return schedule;
  return null;
}
