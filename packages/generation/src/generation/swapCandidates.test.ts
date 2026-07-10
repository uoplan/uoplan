import { describe, expect, it } from "vitest";
import { buildDataCache } from "@uoplan/domain/dataCache";
import type { Catalogue, Course, SchedulesData } from "@uoplan/domain/dataTypes";
import { getEffectiveSchedule } from "../scheduleFilters";
import { getEnrollmentsForCourse, getValidSectionCombos } from "./sectionCombos";
import type { CourseEnrollment, GenerationConstraints } from "./types";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { lectureScheduleWithTimes as makeSchedule } from "../tests/engineTestHelpers";
import { buildSwapOptionView, difficultyBucket, findSwapCandidates } from "./swapCandidates";

const CONSTRAINTS: GenerationConstraints = {
  minStartMinutes: 0,
  maxEndMinutes: 24 * 60,
};

function course(code: string, over: Partial<Course> = {}): Course {
  return {
    code: normalizeCourseCode(code),
    title: `${code} title`,
    credits: 3,
    ...over,
  } as Course;
}

function enrollmentFor(cache: ReturnType<typeof buildDataCache>, code: string): CourseEnrollment {
  const sched = getEffectiveSchedule(cache, code, true, false);
  if (!sched) throw new Error(`no schedule for ${code}`);
  const combos = getValidSectionCombos(sched, CONSTRAINTS);
  return getEnrollmentsForCourse(sched, combos[0]!);
}

describe("findSwapCandidates", () => {
  // OLD (Mon 09:00–10:30) is being swapped; FIXED keeps Wed 12:00–13:00.
  const catalogue: Catalogue = {
    courses: [
      course("OLD 1000"),
      course("FIXED 1000"),
      course("FITS 2000"), // Tue — fits around FIXED
      course("CONFLICT 2000"), // Wed 12:00 — overlaps FIXED
      course("NEEDS 3000", { prereqText: "OLD 1000" }), // gated out with no completed courses
    ],
    programs: [],
  };
  const schedulesData: SchedulesData = {
    termId: "2261",
    schedules: [
      makeSchedule("OLD 1000", [{ day: "Mo", start: 540, end: 630 }]),
      makeSchedule("FIXED 1000", [{ day: "We", start: 720, end: 780 }]),
      makeSchedule("FITS 2000", [{ day: "Tu", start: 540, end: 630 }]),
      makeSchedule("CONFLICT 2000", [{ day: "We", start: 720, end: 780 }]),
      makeSchedule("NEEDS 3000", [{ day: "Th", start: 540, end: 630 }]),
    ],
  };
  const cache = buildDataCache(catalogue, schedulesData);
  const enrollments: CourseEnrollment[] = [
    enrollmentFor(cache, "OLD 1000"),
    enrollmentFor(cache, "FIXED 1000"),
  ];

  it("suggests courses that fit the other enrollments and drops conflicting ones", () => {
    const result = findSwapCandidates({
      cache,
      enrollments,
      enrollmentIndex: 0,
      constraints: CONSTRAINTS,
      includeClosedComponents: true,
      virtualSectionsOnly: false,
    });
    expect(result).toContain(normalizeCourseCode("FITS 2000"));
    expect(result).not.toContain(normalizeCourseCode("CONFLICT 2000"));
  });

  it("never suggests the swapped-out course or courses already in the schedule", () => {
    const result = findSwapCandidates({
      cache,
      enrollments,
      enrollmentIndex: 0,
      constraints: CONSTRAINTS,
      includeClosedComponents: true,
      virtualSectionsOnly: false,
    });
    expect(result).not.toContain(normalizeCourseCode("OLD 1000"));
    expect(result).not.toContain(normalizeCourseCode("FIXED 1000"));
  });

  it("gates out courses with prerequisites when no courses are completed", () => {
    const result = findSwapCandidates({
      cache,
      enrollments,
      enrollmentIndex: 0,
      constraints: CONSTRAINTS,
      includeClosedComponents: true,
      virtualSectionsOnly: false,
    });
    expect(result).not.toContain(normalizeCourseCode("NEEDS 3000"));
  });

  it("honours excludeCodes (e.g. basket courses)", () => {
    const result = findSwapCandidates({
      cache,
      enrollments,
      enrollmentIndex: 0,
      constraints: CONSTRAINTS,
      includeClosedComponents: true,
      virtualSectionsOnly: false,
      excludeCodes: ["FITS 2000"],
    });
    expect(result).not.toContain(normalizeCourseCode("FITS 2000"));
  });

  it("returns empty when the enrollment index is out of range", () => {
    expect(
      findSwapCandidates({
        cache,
        enrollments,
        enrollmentIndex: 9,
        constraints: CONSTRAINTS,
        includeClosedComponents: true,
        virtualSectionsOnly: false,
      }),
    ).toEqual([]);
  });
});

describe("difficultyBucket", () => {
  it("buckets by mean GPA thresholds", () => {
    expect(difficultyBucket(9.2)).toBe("easy");
    expect(difficultyBucket(8)).toBe("moderate");
    expect(difficultyBucket(6)).toBe("tough");
  });
});

describe("buildSwapOptionView", () => {
  it("labels with the course title and derives a difficulty from GPA when available", () => {
    const catalogue: Catalogue = { courses: [course("PSY 1101")], programs: [] };
    const cache = buildDataCache(catalogue, { termId: "2261", schedules: [] });
    const view = buildSwapOptionView("psy1101", cache, null);
    expect(view.code).toBe(normalizeCourseCode("PSY 1101"));
    expect(view.label).toContain("PSY 1101 title");
    // No schedule/grades → no GPA-derived fields.
    expect(view.gpa).toBeNull();
    expect(view.difficulty).toBeNull();
    expect(view.gradeViz).toBeNull();
  });
});
