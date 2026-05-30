/**
 * Lazy, seeded per-course section-combo generation.
 *
 * The legacy `getValidSectionCombos` eagerly materialises the full cartesian
 * product of a course's component sections in a fixed order, then the solver
 * always takes the FIRST conflict-free arrangement — so a given course set
 * always renders with identical times. Here we instead:
 *
 *   - filter sections through the constraint pipeline (section scope),
 *   - seeded-shuffle each component's section list so arrangements vary,
 *   - lazily walk the cartesian product, skipping intra-course time clashes,
 *   - yield each valid combo on demand.
 *
 * Per-course combos are bounded (a handful of sections per component), so the
 * real combinatorial blow-up lives at the cross-course level, which the
 * timetable enumerator explores lazily.
 */
import type { ComponentSection } from "../../dataTypes";
import type { DataCache } from "../../dataCache";
import type { PrecomputedCombo } from "../../generation";
import { isHonoursProject } from "../../utils/courseUtils";
import { shuffleInPlace } from "../../poolHelpers";
import {
  canonicalCourseCode,
  enrollmentForPicker,
  getEnrollmentsForCourse,
} from "../../generation/sectionCombos";
import { timesOverlap } from "../../generation/overlaps";
import { collectTimes, sectionHasTimes } from "../../generation/sectionCombos";
import type { ConstraintContext } from "../constraints/types";
import type { ConstraintPipeline } from "../constraints/pipeline";

function comboHasInternalOverlap(sections: ComponentSection[]): boolean {
  const times = collectTimes(sections);
  for (let i = 0; i < times.length; i++) {
    for (let j = i + 1; j < times.length; j++) {
      if (timesOverlap(times[i], times[j])) return true;
    }
  }
  return false;
}

/**
 * Lazily yields valid {@link PrecomputedCombo}s for a single course, in an order
 * randomised by `rng` (so repeated enumerations across seeds surface different
 * section/time arrangements first).
 *
 * Honours projects yield exactly one empty combo (they are not timetabled).
 */
export function* lazyCourseCombos(
  code: string,
  cache: DataCache,
  pipeline: ConstraintPipeline,
  ctx: ConstraintContext,
  rng: () => number,
): Generator<PrecomputedCombo> {
  if (isHonoursProject(code, cache)) {
    const combo = {};
    yield { combo, enrollment: enrollmentForPicker(code, combo, cache) };
    return;
  }

  const schedule = cache.getSchedule(code);
  if (!schedule) return;

  const componentKeys = Object.keys(schedule.components).sort();
  const sectionArrays: ComponentSection[][] = [];
  for (const key of componentKeys) {
    const sections = (schedule.components[key] ?? []).filter(
      (section) =>
        sectionHasTimes(section) && pipeline.allowsSection(schedule.courseCode, section, ctx),
    );
    if (sections.length === 0) return; // a required component has no usable section
    // Seeded order so different arrangements appear first on different seeds.
    shuffleInPlace(sections, rng);
    sectionArrays.push(sections);
  }

  // Lazy cartesian walk via index odometer over the shuffled section arrays.
  const indices = new Array(sectionArrays.length).fill(0);
  const total = sectionArrays.reduce((n, a) => n * a.length, 1);
  for (let produced = 0; produced < total; produced++) {
    const sections = sectionArrays.map((arr, i) => arr[indices[i]]);
    if (!comboHasInternalOverlap(sections)) {
      const obj: Record<string, { section: ComponentSection }> = {};
      componentKeys.forEach((key, idx) => {
        obj[key] = { section: sections[idx] };
      });
      yield { combo: obj, enrollment: getEnrollmentsForCourse(schedule, obj) };
    }
    // advance odometer
    for (let i = sectionArrays.length - 1; i >= 0; i--) {
      indices[i]++;
      if (indices[i] < sectionArrays[i].length) break;
      indices[i] = 0;
    }
  }
}

export interface TimetableCourse {
  code: string;
  combos: PrecomputedCombo[];
}

/**
 * Materialises a course's seeded combos into a {@link TimetableCourse}. Returns
 * null when the course has no usable arrangement (no schedule row, or all
 * sections filtered out). Per-course combo sets are small enough to hold.
 */
export function buildTimetableCourse(
  code: string,
  cache: DataCache,
  pipeline: ConstraintPipeline,
  ctx: ConstraintContext,
  rng: () => number,
): TimetableCourse | null {
  const combos: PrecomputedCombo[] = [];
  for (const combo of lazyCourseCombos(code, cache, pipeline, ctx, rng)) {
    combos.push(combo);
  }
  if (combos.length === 0) return null;
  return { code: canonicalCourseCode(code, cache), combos };
}
