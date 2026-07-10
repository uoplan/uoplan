import { describe, expect, it } from "vitest";
import { courseFitsWith, firstFittingEnrollment } from "../swap";
import { getEnrollmentsForCourse, getValidSectionCombos } from "../sectionCombos";
import type { CourseEnrollment, GenerationConstraints } from "../types";
import type { ComponentSection, CourseSchedule, MeetingTime } from "@uoplan/domain/dataTypes";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";

const NO_CONSTRAINTS: GenerationConstraints = {
  minStartMinutes: 0,
  maxEndMinutes: 24 * 60,
};

function meeting(day: MeetingTime["day"], start: number, end: number): MeetingTime {
  return { day, startMinutes: start, endMinutes: end, virtual: false };
}

function section(name: string, times: MeetingTime[]): ComponentSection {
  return {
    section: name,
    sectionCode: name,
    component: "LEC",
    session: null,
    times,
    status: "Open",
  };
}

function schedule(code: string, lectureSections: ComponentSection[]): CourseSchedule {
  return {
    subject: code.slice(0, 3),
    catalogNumber: code.slice(4),
    courseCode: normalizeCourseCode(code),
    title: code,
    timeZone: "America/Toronto",
    components: { LEC: lectureSections },
  };
}

function csi2110WithMondayAndTuesdayOptions(): CourseSchedule {
  return schedule("CSI 2110", [
    section("A", [meeting("Mo", 600, 660)]),
    section("B", [meeting("Tu", 600, 660)]),
  ]);
}

function enrollmentAt(
  code: string,
  day: MeetingTime["day"],
  start: number,
  end: number,
): CourseEnrollment {
  return {
    courseCode: normalizeCourseCode(code),
    sectionCombo: {},
    times: [{ day, startMinutes: start, endMinutes: end }],
  };
}

describe("firstFittingEnrollment", () => {
  it("returns the first valid combo when nothing else is scheduled", () => {
    const data = schedule("CSI 2110", [section("A", [meeting("Mo", 600, 660)])]);
    const result = firstFittingEnrollment(data, NO_CONSTRAINTS, []);
    expect(result).not.toBeNull();
    expect(result?.courseCode).toBe(normalizeCourseCode("CSI 2110"));
    expect(result?.times).toEqual([
      { day: "Mo", startMinutes: 600, endMinutes: 660, meetingDates: null },
    ]);
  });

  it("skips a section that overlaps an existing enrollment and returns the next that fits", () => {
    const data = csi2110WithMondayAndTuesdayOptions();
    const others = [enrollmentAt("MAT 1320", "Mo", 600, 660)];
    const result = firstFittingEnrollment(data, NO_CONSTRAINTS, others);
    expect(result?.times).toEqual([
      { day: "Tu", startMinutes: 600, endMinutes: 660, meetingDates: null },
    ]);
  });

  it("returns null when every section conflicts with the existing schedule", () => {
    const data = schedule("CSI 2110", [
      section("A", [meeting("Mo", 600, 660)]),
      section("B", [meeting("Mo", 630, 690)]),
    ]);
    const others = [enrollmentAt("MAT 1320", "Mo", 590, 700)];
    expect(firstFittingEnrollment(data, NO_CONSTRAINTS, others)).toBeNull();
  });

  it("respects time-window constraints (no section satisfies the window -> null)", () => {
    const data = schedule("CSI 2110", [section("A", [meeting("Mo", 480, 540)])]); // 08:00-09:00
    const constrained: GenerationConstraints = { minStartMinutes: 600, maxEndMinutes: 24 * 60 };
    expect(firstFittingEnrollment(data, constrained, [])).toBeNull();
    // Same data, relaxed window -> fits.
    expect(firstFittingEnrollment(data, NO_CONSTRAINTS, [])).not.toBeNull();
  });

  it("agrees with the underlying combo enumeration", () => {
    const data = csi2110WithMondayAndTuesdayOptions();
    const others = [enrollmentAt("MAT 1320", "Mo", 600, 660)];
    const combos = getValidSectionCombos(data, NO_CONSTRAINTS);
    const expected = combos
      .map((c) => getEnrollmentsForCourse(data, c))
      .find((e) => !e.times.some((t) => t.day === "Mo" && t.startMinutes === 600));
    expect(firstFittingEnrollment(data, NO_CONSTRAINTS, others)).toEqual(expected);
  });
});

describe("courseFitsWith", () => {
  it("is true when a non-overlapping combo exists", () => {
    const data = schedule("CSI 2110", [section("A", [meeting("Mo", 600, 660)])]);
    expect(courseFitsWith(data, NO_CONSTRAINTS, [enrollmentAt("MAT 1320", "Tu", 600, 660)])).toBe(
      true,
    );
  });

  it("is false when all combos overlap", () => {
    const data = schedule("CSI 2110", [section("A", [meeting("Mo", 600, 660)])]);
    expect(courseFitsWith(data, NO_CONSTRAINTS, [enrollmentAt("MAT 1320", "Mo", 600, 660)])).toBe(
      false,
    );
  });
});
