import type {
  DataCache,
  GeneratedSchedule,
  GenerationConstraints,
  DecodedState,
} from "@uoplan/schedule";
import {
  generateSchedules,
  createSeededRng,
  getValidSectionCombos,
  getEnrollmentsForCourse,
  enrollmentsOverlap,
  getEffectiveSchedule,
} from "@uoplan/schedule";

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function applyOneSwap(
  schedule: GeneratedSchedule,
  enrollmentIndex: number,
  newCourseCode: string,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  const scheduleData = getEffectiveSchedule(cache, newCourseCode, false, false);
  if (!scheduleData) return null;

  const combos = getValidSectionCombos(scheduleData, constraints);
  const others = schedule.enrollments.filter((_, i) => i !== enrollmentIndex);

  for (const combo of combos) {
    const candidate = getEnrollmentsForCourse(scheduleData, combo);
    if (!others.some((e) => enrollmentsOverlap(e, candidate))) {
      const newEnrollments = [...schedule.enrollments];
      newEnrollments[enrollmentIndex] = candidate;
      return { enrollments: newEnrollments };
    }
  }

  return null;
}

/**
 * Reconstruct a schedule from decoded state for use in OG image preview.
 * Best-effort: uses seed-shuffled course list and applies swaps.
 */
export function reconstructScheduleForPreview(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  const seed = decoded.currentSeed || decoded.firstSeed;
  const rng = createSeededRng(seed >>> 0);

  const courseCodes = [
    ...decoded.courseSelections.flatMap((s) => s.courseCodes),
    ...decoded.basicPinnedCourses,
  ];

  const deduplicated = [...new Set(courseCodes)];
  const targetCount = decoded.coursesThisSemester || deduplicated.length;

  shuffleInPlace(deduplicated, rng);

  const schedules = generateSchedules(deduplicated, targetCount, cache, constraints, 1);
  if (schedules.length === 0) return null;

  let schedule = schedules[0];

  for (const swap of decoded.swaps) {
    const result = applyOneSwap(
      schedule,
      swap.enrollmentIndex,
      swap.courseCode,
      cache,
      constraints,
    );
    if (result) schedule = result;
  }

  return schedule;
}
