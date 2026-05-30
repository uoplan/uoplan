/**
 * Timetable enumerator: given a fixed required course set, lazily yields every
 * DISTINCT conflict-free section/time arrangement.
 *
 * This is the core fix for two legacy bugs:
 *   - "times never vary": the old solver returned only the first arrangement.
 *     Here we yield all of them, in a seeded order (per-course combos are
 *     shuffled upstream), so navigation surfaces genuinely different timetables
 *     for the same courses.
 *   - "runs out early": dedup downstream is by full timetable, so the large
 *     space of arrangements is actually traversed instead of collapsed to one.
 *
 * Inter-course pruning (overlap, etc.) is incremental via
 * `pipeline.allowsEnrollment`; whole-timetable rules (compressed schedule, …)
 * are checked at the leaf via `pipeline.allowsFinalTimetable`.
 */
import type { CourseEnrollment, GeneratedSchedule } from "../../generation";
import type { ConstraintContext } from "../constraints/types";
import type { ConstraintPipeline } from "../constraints/pipeline";
import type { TimetableCourse } from "./lazyCombos";

/**
 * Yields each distinct conflict-free arrangement (one combo per course) of the
 * full `courses` set. Courses are visited fewest-combos-first to prune early;
 * this affects efficiency only, not which arrangements are produced.
 */
export function* enumerateArrangements(
  courses: readonly TimetableCourse[],
  pipeline: ConstraintPipeline,
  ctx: ConstraintContext,
): Generator<GeneratedSchedule> {
  const ordered = [...courses].sort((a, b) => a.combos.length - b.combos.length);
  const chosen: CourseEnrollment[] = [];

  function* solve(idx: number): Generator<GeneratedSchedule> {
    if (idx === ordered.length) {
      if (pipeline.allowsFinalTimetable(chosen, ctx)) {
        yield { enrollments: chosen.map((e) => e) };
      }
      return;
    }
    for (const combo of ordered[idx].combos) {
      const candidate = combo.enrollment;
      if (!pipeline.allowsEnrollment(candidate, chosen, ctx)) continue;
      chosen.push(candidate);
      yield* solve(idx + 1);
      chosen.pop();
    }
  }

  yield* solve(0);
}

/**
 * Stable, order-independent fingerprint of a full timetable: course codes plus
 * the chosen section per component. Used to dedup arrangements across the
 * stream (two arrangements differing only in section order are identical).
 */
export function arrangementFingerprint(schedule: GeneratedSchedule): string {
  const parts = schedule.enrollments.map((e) => {
    const sections = Object.keys(e.sectionCombo)
      .sort()
      .map((k) => `${k}:${e.sectionCombo[k].section.section}`)
      .join("|");
    return `${e.courseCode}{${sections}}`;
  });
  return parts.sort().join(",");
}
