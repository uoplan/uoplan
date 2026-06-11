import { SchedulePayload } from "@uoplan/proto/cli";
import type { GeneratedSchedule } from "@uoplan/core/src/generation/types";
import { encodeBytesBase64Url } from "./base64Url";

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

  return encodeBytesBase64Url(SchedulePayload.encode(payload).finish());
}
