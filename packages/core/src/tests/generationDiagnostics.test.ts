import { describe, it, expect } from "vitest";
import { diagnoseTimetableFailure } from "../generationDiagnostics";
import { buildDataCache } from "../dataCache";
import type { Catalogue } from "../dataTypes";
import type { SchedulesData, CourseSchedule, DayOfWeek } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";

const emptyCatalogue: Catalogue = { courses: [], programs: [] };

function makeSchedule(
  courseCode: string,
  times: { day: DayOfWeek; start: number; end: number }[],
): CourseSchedule {
  return {
    subject: courseCode.split(" ")[0],
    catalogNumber: courseCode.split(" ")[1],
    courseCode: normalizeCourseCode(courseCode),
    title: null,
    timeZone: "America/Toronto",
    components: {
      LEC: [
        {
          section: "M00",
          sectionCode: "M00",
          component: "LEC",
          session: null,
          times: times.map((t) => ({
            day: t.day,
            startMinutes: t.start,
            endMinutes: t.end,
            virtual: false,
          })),
          status: null,
        },
      ],
    },
  };
}

describe("diagnoseTimetableFailure", () => {
  it("classifies too_few when not enough courses have timetable data", () => {
    const schedulesData: SchedulesData = {
      termId: "2261",
      schedules: [makeSchedule("A 1000", [{ day: "Mo", start: 480, end: 570 }])],
    };
    const cache = buildDataCache(emptyCatalogue, schedulesData);
    const d = diagnoseTimetableFailure({
      pinnedCourseCodes: [],
      optionalCourseCodes: ["A 1000", "B 2000"],
      targetCount: 2,
      cache,
    });
    expect(d.kind).toBe("too_few_courses_with_combos");
    expect(d.eligibleCourseCount).toBe(1);
    expect(d.coursesWithNoCombo.length).toBeGreaterThanOrEqual(1);
  });

  it("classifies no_section_combos when every course lacks valid sections", () => {
    const schedulesData: SchedulesData = {
      termId: "2261",
      schedules: [],
    };
    const cache = buildDataCache(emptyCatalogue, schedulesData);
    const d = diagnoseTimetableFailure({
      pinnedCourseCodes: [],
      optionalCourseCodes: ["X 1000", "Y 2000"],
      targetCount: 2,
      cache,
    });
    expect(d.kind).toBe("no_section_combos");
    expect(d.eligibleCourseCount).toBe(0);
  });

  it("classifies no_conflict_free_assignment when combos exist but no non-overlapping schedule", () => {
    const schedulesData: SchedulesData = {
      termId: "2261",
      schedules: [
        makeSchedule("A 1000", [{ day: "Mo", start: 480, end: 570 }]),
        makeSchedule("B 2000", [{ day: "Mo", start: 510, end: 600 }]),
      ],
    };
    const cache = buildDataCache(emptyCatalogue, schedulesData);
    const d = diagnoseTimetableFailure({
      pinnedCourseCodes: [],
      optionalCourseCodes: ["A 1000", "B 2000"],
      targetCount: 2,
      cache,
    });
    expect(d.kind).toBe("no_conflict_free_assignment");
    expect(d.eligibleCourseCount).toBe(2);
    expect(d.suggestions).not.toContain("turn-off-compressed");
  });

  it("classifies pinned course with no sections as no_section_combos", () => {
    const schedulesData: SchedulesData = {
      termId: "2261",
      schedules: [makeSchedule("A 1000", [{ day: "Mo", start: 480, end: 570 }])],
    };
    const cache = buildDataCache(emptyCatalogue, schedulesData);
    const d = diagnoseTimetableFailure({
      pinnedCourseCodes: ["B 2000"],
      optionalCourseCodes: ["A 1000"],
      targetCount: 2,
      cache,
    });
    expect(d.kind).toBe("no_section_combos");
    expect(d.coursesWithNoCombo).toContain("B 2000");
  });

  it("does NOT blame Compressed when the courses themselves overlap (structural)", () => {
    // A and B overlap on Monday, so no filter change can help — turning off
    // Compressed would be misleading. Relaxation must report this honestly.
    const schedulesData: SchedulesData = {
      termId: "2261",
      schedules: [
        makeSchedule("A 1000", [{ day: "Mo", start: 480, end: 570 }]),
        makeSchedule("B 2000", [{ day: "Mo", start: 510, end: 600 }]),
      ],
    };
    const cache = buildDataCache(emptyCatalogue, schedulesData);
    const d = diagnoseTimetableFailure({
      pinnedCourseCodes: [],
      optionalCourseCodes: ["A 1000", "B 2000"],
      targetCount: 2,
      cache,
      constraints: {
        minStartMinutes: 8 * 60,
        maxEndMinutes: 22 * 60,
        compressedSchedule: true,
      },
    });
    expect(d.relaxation?.kind).toBe("structural_conflict");
    expect(d.suggestions).not.toContain("turn-off-compressed");
    expect(d.suggestions).toContain("structural-conflict");
    expect(d.lead.code).toBe("structural-conflict");
  });

  it("blames Compressed only when removing it actually unblocks a timetable", () => {
    // A (08:00-09:30) and B (13:20-14:50) on Monday are conflict-free but leave a
    // long mid-day gap, so Compressed rejects them; removing it lets them fit.
    const schedulesData: SchedulesData = {
      termId: "2261",
      schedules: [
        makeSchedule("A 1000", [{ day: "Mo", start: 480, end: 570 }]),
        makeSchedule("B 2000", [{ day: "Mo", start: 800, end: 890 }]),
      ],
    };
    const cache = buildDataCache(emptyCatalogue, schedulesData);
    const d = diagnoseTimetableFailure({
      pinnedCourseCodes: [],
      optionalCourseCodes: ["A 1000", "B 2000"],
      targetCount: 2,
      cache,
      constraints: {
        minStartMinutes: 8 * 60,
        maxEndMinutes: 22 * 60,
        compressedSchedule: true,
      },
    });
    expect(d.relaxation?.kind).toBe("single_blockers");
    expect(d.suggestions).toContain("turn-off-compressed");
  });
});
