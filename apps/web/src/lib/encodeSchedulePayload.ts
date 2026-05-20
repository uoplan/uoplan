import { SchedulePayload } from "schedule/src/proto/cli";
import type { GeneratedSchedule } from "schedule/src/generation/types";

export function encodeSchedulePayload(schedule: GeneratedSchedule, termId: string): string {
  const payload: SchedulePayload = {
    termId: Number(termId),
    courses: schedule.enrollments.map((e) => ({
      courseCode: e.courseCode,
      sections: Object.entries(e.sectionCombo).map(([component, { section }]) => ({
        component,
        section: section.section,
      })),
    })),
  };

  const bytes = SchedulePayload.encode(payload).finish();

  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
