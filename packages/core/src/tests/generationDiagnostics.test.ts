import { describe, expect, it } from "vitest";
import { diagnoseTimetableFailure } from "../generationDiagnostics";
import { buildDataCache } from "../dataCache";
import type { Catalogue, DayOfWeek, SchedulesData } from "../dataTypes";
import { lectureScheduleWithTimes as makeSchedule } from "@uoplan/generation/tests/engineTestHelpers";

const emptyCatalogue: Catalogue = { courses: [], programs: [] };

type DiagnoseInput = Parameters<typeof diagnoseTimetableFailure>[0];
type ScheduleSpec = {
  courseCode: string;
  day: DayOfWeek;
  start: number;
  end: number;
};

function scheduledCourse(
  courseCode: string,
  day: DayOfWeek,
  start: number,
  end: number,
): ScheduleSpec {
  return { courseCode, day, start, end };
}

function buildCacheForSchedules(specs: ScheduleSpec[]): ReturnType<typeof buildDataCache> {
  const schedulesData: SchedulesData = {
    termId: "2261",
    schedules: specs.map(({ courseCode, day, start, end }) =>
      makeSchedule(courseCode, [{ day, start, end }]),
    ),
  };
  return buildDataCache(emptyCatalogue, schedulesData);
}

function diagnoseWithSchedules(
  specs: ScheduleSpec[],
  over: Partial<Omit<DiagnoseInput, "cache">> = {},
) {
  return diagnoseTimetableFailure({
    pinnedCourseCodes: [],
    optionalCourseCodes: ["A 1000", "B 2000"],
    targetCount: 2,
    cache: buildCacheForSchedules(specs),
    ...over,
  });
}

describe("diagnoseTimetableFailure", () => {
  it("classifies too_few when not enough courses have timetable data", () => {
    const d = diagnoseWithSchedules([scheduledCourse("A 1000", "Mo", 480, 570)]);
    expect(d.kind).toBe("too_few_courses_with_combos");
    expect(d.eligibleCourseCount).toBe(1);
    expect(d.coursesWithNoCombo.length).toBeGreaterThanOrEqual(1);
  });

  it("classifies no_section_combos when every course lacks valid sections", () => {
    const d = diagnoseWithSchedules([], { optionalCourseCodes: ["X 1000", "Y 2000"] });
    expect(d.kind).toBe("no_section_combos");
    expect(d.eligibleCourseCount).toBe(0);
  });

  it("classifies no_conflict_free_assignment when combos exist but no non-overlapping schedule", () => {
    const d = diagnoseWithSchedules([
      scheduledCourse("A 1000", "Mo", 480, 570),
      scheduledCourse("B 2000", "Mo", 510, 600),
    ]);
    expect(d.kind).toBe("no_conflict_free_assignment");
    expect(d.eligibleCourseCount).toBe(2);
    expect(d.suggestions).not.toContain("turn-off-compressed");
  });

  it("classifies pinned course with no sections as no_section_combos", () => {
    const d = diagnoseWithSchedules([scheduledCourse("A 1000", "Mo", 480, 570)], {
      pinnedCourseCodes: ["B 2000"],
      optionalCourseCodes: ["A 1000"],
    });
    expect(d.kind).toBe("no_section_combos");
    expect(d.coursesWithNoCombo).toContain("B 2000");
  });
});
