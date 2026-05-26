import type { GeneratedSchedule } from "@uoplan/schedule";

export function buildColorMap(
  schedule: GeneratedSchedule,
  prevMap: Record<string, number>,
): Record<string, number> {
  const map: Record<string, number> = {};
  const usedIndices = new Set<number>();

  for (const { courseCode } of schedule.enrollments) {
    if (prevMap[courseCode] !== undefined) {
      map[courseCode] = prevMap[courseCode];
      usedIndices.add(prevMap[courseCode]);
    }
  }

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
