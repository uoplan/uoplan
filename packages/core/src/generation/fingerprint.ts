import type { GeneratedSchedule } from "./types";

/**
 * Stable, order-independent fingerprint of a full timetable: course codes plus
 * the chosen section per component. Two arrangements differing only in section
 * order are identical. Used by the UI store to dedup generated timetables.
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
