import type { CourseSchedule } from "@uoplan/core";

import { testCourseCode } from "./brands";

export function testScheduledCourse(code: string): CourseSchedule {
  const [subject, catalogNumber] = code.split(/\s+/);
  return {
    subject,
    catalogNumber,
    courseCode: testCourseCode(code),
    title: code,
    timeZone: "America/Toronto",
    components: {
      LEC: [
        {
          section: "A",
          sectionCode: "A",
          component: "LEC",
          session: null,
          status: null,
          times: [
            { day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false, instructor: null },
          ],
        },
      ],
    },
  };
}
