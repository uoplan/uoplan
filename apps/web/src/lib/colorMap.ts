import type { GeneratedSchedule } from "schedule";

/**
 * Build a courseCode → colorIndex (0–7) map for a schedule.
 *
 * Courses that appear in prevMap keep their color index so that adjacent
 * schedules show the same course in the same colour. New courses are
 * assigned the lowest index not already used by a course in this schedule.
 */
export function buildColorMap(
  schedule: GeneratedSchedule,
  prevMap: Record<string, number>,
): Record<string, number> {
  const map: Record<string, number> = {};
  const usedIndices = new Set<number>();

  // Pass 1: inherit colours from the previous schedule
  for (const { courseCode } of schedule.enrollments) {
    if (prevMap[courseCode] !== undefined) {
      map[courseCode] = prevMap[courseCode];
      usedIndices.add(prevMap[courseCode]);
    }
  }

  // Pass 2: assign the lowest unused index to new courses
  let nextIndex = 0;
  for (const { courseCode } of schedule.enrollments) {
    if (map[courseCode] !== undefined) continue;
    let attempts = 0;
    while (usedIndices.has(nextIndex % 15) && attempts < 15) {
      nextIndex++;
      attempts++;
    }
    const idx = nextIndex % 15;
    map[courseCode] = idx;
    usedIndices.add(idx);
    nextIndex++;
  }

  return map;
}
