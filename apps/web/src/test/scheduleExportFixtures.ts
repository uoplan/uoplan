import type { GenerateSchedulesResult } from "../lib/generateSchedulesAction";
import { normalizeCourseCode } from "@uoplan/core";

/**
 * A fully valid, dated weekly-Monday-lecture graph-planner schedule bundle —
 * carries every field `scheduleToCalendarEvents` reads (day/minutes/course
 * code plus a dated `meetingDates` recurrence window), so it can drive the
 * real ICS pipeline end-to-end. Shared by the graph planner schedule-export
 * dialog's hook-level and integration-level tests.
 */
export function realGraphPlannerBundle(
  meetingDates: [string, string],
  courseCode = "CSI 2132",
): GenerateSchedulesResult {
  return {
    currentSchedule: {
      enrollments: [
        {
          courseCode: normalizeCourseCode(courseCode),
          times: [{ day: "Mo", startMinutes: 540, endMinutes: 600 }],
          sectionCombo: {
            LEC: {
              section: {
                section: "A00-LEC",
                sectionCode: "A00",
                component: "LEC",
                session: null,
                times: [
                  {
                    day: "Mo",
                    startMinutes: 540,
                    endMinutes: 600,
                    virtual: false,
                    instructor: null,
                    meetingDates,
                  },
                ],
                status: null,
              },
            },
          },
        },
      ],
    },
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: null,
  } as unknown as GenerateSchedulesResult;
}
