import { SchedulePayload } from "@uoplan/proto/cli";
import type { GeneratedSchedule } from "@uoplan/core/src/generation/types";

export function encodeSchedulePayload(schedule: GeneratedSchedule, termId: string): string {
  const payload: SchedulePayload = {
    termId: Number(termId),
    courses: schedule.enrollments
      .filter((e) => Object.keys(e.sectionCombo).length > 0)
      .map((e) => ({
        courseCode: e.courseCode,
        sections: Object.entries(e.sectionCombo).map(([component, { section }]) => ({
          component,
          section:
            section.sectionCode ??
            (section.section.match(/^([A-Za-z0-9]+)-/) ?? [])[1] ??
            section.section,
        })),
      })),
  };

  const bytes = SchedulePayload.encode(payload).finish();

  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
