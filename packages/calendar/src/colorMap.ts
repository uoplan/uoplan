import type { GeneratedSchedule } from "@uoplan/schedule";

export function buildColorMap(schedule: GeneratedSchedule): Record<string, number> {
  const codes = [...new Set(schedule.enrollments.map((e) => e.courseCode))].sort();
  const map: Record<string, number> = {};
  codes.forEach((code, i) => {
    map[code] = i % 15;
  });
  return map;
}
