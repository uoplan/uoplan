import { describe, expect, it } from "vitest";
import {
  decodeTermMeta,
  isUnknownInstructorName as coreIsUnknown,
  normalizeInstructorName as coreNormalize,
} from "@uoplan/core";
import {
  __predictInstructorsTest as __test,
  buildPredictionContext,
  predictInstructorsForTerm,
  sectionKey,
  type GradesCourseInput,
  type ScheduleFileInput,
} from "./predictInstructors.ts";

const TARGET_TERM = 2271; // Winter 2027 → year 2027

type TestSection = {
  section: string;
  times: Array<{
    day: string;
    startMinutes: number;
    endMinutes: number;
    instructor?: string;
  }>;
};

type TestCourse = {
  courseCode: string;
  components: Record<string, TestSection[]>;
};

function gradesFor(
  code: string,
  rows: Array<{ name: string; termId: number; legacyId?: number }>,
): GradesCourseInput {
  return { code, professors: rows };
}

function scheduleFile(termId: number, courses: TestCourse[]): ScheduleFileInput {
  return { termId, schedules: courses };
}

function section(
  sectionCode: string,
  instructor = "Staff",
  day = "Mo",
  startMinutes = 600,
  endMinutes = 690,
): TestSection {
  return {
    section: sectionCode,
    times: [{ day, startMinutes, endMinutes, instructor }],
  };
}

function course(courseCode: string, sections: TestSection[], component = "LEC"): TestCourse {
  return { courseCode, components: { [component]: sections } };
}

function targetSchedule(courses: TestCourse[]): ScheduleFileInput {
  return scheduleFile(TARGET_TERM, courses);
}

function targetStaffSchedule(sectionOverride: Partial<TestSection> = {}): ScheduleFileInput {
  return targetSchedule([
    course("CSI 2110", [
      {
        ...section("A00"),
        ...sectionOverride,
      },
    ]),
  ]);
}

describe("predictInstructorsForTerm", () => {
  it("only predicts for sections with no known instructor", () => {
    const context = buildPredictionContext({
      grades: [gradesFor("CSI 2110", [{ name: "Ada Lovelace", termId: 2261, legacyId: 1 }])],
      scheduleFiles: [],
    });
    const target = targetSchedule([
      course("CSI 2110", [section("A00", "Grace Hopper"), section("B00", "Staff", "Tu")]),
    ]);
    const out = predictInstructorsForTerm(target, context);
    expect(out.has(sectionKey("CSI 2110", "LEC", "A00"))).toBe(false);
    expect(out.get(sectionKey("CSI 2110", "LEC", "B00"))).toEqual([
      { name: "Ada Lovelace", legacyId: 1 },
    ]);
  });

  it("excludes candidates outside the recency window", () => {
    const context = buildPredictionContext({
      grades: [
        gradesFor("CSI 2110", [
          { name: "Recent Prof", termId: 2251, legacyId: 1 }, // 2025, within 3yr of 2027
          { name: "Old Prof", termId: 2191, legacyId: 2 }, // 2019, > 3yr before 2027
        ]),
      ],
      scheduleFiles: [],
    });
    const target = targetStaffSchedule();
    const out = predictInstructorsForTerm(target, context, {
      recencyYears: 3,
    });
    expect(out.get(sectionKey("CSI 2110", "LEC", "A00"))).toEqual([
      { name: "Recent Prof", legacyId: 1 },
    ]);
  });

  it("excludes candidates already teaching the same term at an overlapping time", () => {
    const context = buildPredictionContext({
      grades: [
        gradesFor("CSI 2110", [
          { name: "Busy Prof", termId: 2261, legacyId: 1 },
          { name: "Free Prof", termId: 2261, legacyId: 2 },
        ]),
      ],
      scheduleFiles: [],
    });
    const target = targetSchedule([
      // Busy Prof is teaching MAT 1320 Mo 10:00-11:30 in the target term.
      course("MAT 1320", [section("Z00", "Busy Prof")]),
      // Unassigned section overlaps Mo 10:30-12:00 → conflicts with Busy Prof.
      course("CSI 2110", [section("A00", "Staff", "Mo", 630, 720)]),
    ]);
    const out = predictInstructorsForTerm(target, context);
    expect(out.get(sectionKey("CSI 2110", "LEC", "A00"))).toEqual([
      { name: "Free Prof", legacyId: 2 },
    ]);
  });

  it("keeps a candidate teaching the same term at a non-overlapping time", () => {
    const context = buildPredictionContext({
      grades: [gradesFor("CSI 2110", [{ name: "Busy Prof", termId: 2261, legacyId: 1 }])],
      scheduleFiles: [],
    });
    const target = targetSchedule([
      course("MAT 1320", [section("Z00", "Busy Prof")]),
      // Tuesday — no overlap with Busy Prof's Monday slot.
      course("CSI 2110", [section("A00", "Staff", "Tu")]),
    ]);
    const out = predictInstructorsForTerm(target, context);
    expect(out.get(sectionKey("CSI 2110", "LEC", "A00"))).toEqual([
      { name: "Busy Prof", legacyId: 1 },
    ]);
  });

  it("merges duplicate names, preferring the grades canonical name + legacyId", () => {
    const context = buildPredictionContext({
      grades: [gradesFor("CSI 2110", [{ name: "Frédéric Côté", termId: 2261, legacyId: 99 }])],
      scheduleFiles: [
        scheduleFile(2261, [
          // Accent-stripped duplicate from a schedule file, no legacyId.
          course("CSI 2110", [section("A00", "Frederic Cote")]),
        ]),
      ],
    });
    const target = targetStaffSchedule({
      section: "B00",
      times: [section("B00", "Staff", "We").times[0]],
    });
    const guesses = predictInstructorsForTerm(target, context).get(
      sectionKey("CSI 2110", "LEC", "B00"),
    );
    expect(guesses).toEqual([{ name: "Frédéric Côté", legacyId: 99 }]);
  });

  it("orders by most recent year and caps at maxGuesses", () => {
    const rows = [
      { name: "P2024", termId: 2245, legacyId: 1 }, // 2024
      { name: "P2026", termId: 2261, legacyId: 2 }, // 2026
      { name: "P2025", termId: 2251, legacyId: 3 }, // 2025
    ];
    const context = buildPredictionContext({
      grades: [gradesFor("CSI 2110", rows)],
      scheduleFiles: [],
    });
    const target = targetStaffSchedule();
    const all = predictInstructorsForTerm(target, context).get(
      sectionKey("CSI 2110", "LEC", "A00"),
    );
    expect(all?.map((g) => g.name)).toEqual(["P2026", "P2025", "P2024"]);
    const capped = predictInstructorsForTerm(target, context, {
      maxGuesses: 2,
    }).get(sectionKey("CSI 2110", "LEC", "A00"));
    expect(capped?.map((g) => g.name)).toEqual(["P2026", "P2025"]);
  });

  it("omits legacyId when it cannot be resolved", () => {
    const context = buildPredictionContext({
      grades: [],
      scheduleFiles: [scheduleFile(2261, [course("CSI 2110", [section("A00", "Nameless Prof")])])],
    });
    const target = targetStaffSchedule({
      section: "B00",
      times: [section("B00", "Staff", "Tu").times[0]],
    });
    expect(
      predictInstructorsForTerm(target, context).get(sectionKey("CSI 2110", "LEC", "B00")),
    ).toEqual([{ name: "Nameless Prof" }]);
  });

  it("prefers active-term candidates over absent ones (tier 1)", () => {
    const context = buildPredictionContext({
      grades: [
        gradesFor("CSI 2110", [
          { name: "Active Prof", termId: 2261, legacyId: 1 },
          { name: "Absent Prof", termId: 2261, legacyId: 2 },
        ]),
      ],
      scheduleFiles: [],
    });
    const target = targetSchedule([
      // Active Prof is teaching some other known section in the target term.
      course("MAT 1320", [section("Z00", "Active Prof", "Fr", 540, 630)]),
      course("CSI 2110", [section("A00")]),
    ]);
    // Absent Prof taught the course recently but is not in the term → an active
    // candidate exists, so the absent one is dropped.
    expect(
      predictInstructorsForTerm(target, context).get(sectionKey("CSI 2110", "LEC", "A00")),
    ).toEqual([{ name: "Active Prof", legacyId: 1 }]);
  });

  it("falls back to recent inactive instructors when nobody is active (tier 2)", () => {
    const context = buildPredictionContext({
      grades: [
        gradesFor("CSI 2110", [
          { name: "Absent A", termId: 2261, legacyId: 1 }, // 2026
          { name: "Absent B", termId: 2251, legacyId: 2 }, // 2025
        ]),
      ],
      scheduleFiles: [],
    });
    const target = targetStaffSchedule();
    // Neither candidate teaches in the target term, so both surface (recent-first).
    expect(
      predictInstructorsForTerm(target, context).get(sectionKey("CSI 2110", "LEC", "A00")),
    ).toEqual([
      { name: "Absent A", legacyId: 1 },
      { name: "Absent B", legacyId: 2 },
    ]);
  });

  it("fallbackToInactive: false yields no guess when nobody is active", () => {
    const context = buildPredictionContext({
      grades: [gradesFor("CSI 2110", [{ name: "Absent Prof", termId: 2261, legacyId: 1 }])],
      scheduleFiles: [],
    });
    const target = targetStaffSchedule();
    expect(
      predictInstructorsForTerm(target, context, { fallbackToInactive: false }).has(
        sectionKey("CSI 2110", "LEC", "A00"),
      ),
    ).toBe(false);
  });
});

describe("inlined helpers stay in parity with @uoplan/core", () => {
  it("termYear matches decodeTermMeta(...).year", () => {
    for (const termId of [2271, 2261, 2251, 2191, 2179, 9999, 1234, 0]) {
      expect(__test.termYear(termId)).toBe(decodeTermMeta(termId).year);
    }
  });

  it("normalizeInstructorName matches core", () => {
    for (const name of ["Frédéric Côté", "  Ada   Lovelace ", "STAFF", "John  Doe"]) {
      expect(__test.normalizeInstructorName(name)).toBe(coreNormalize(name));
    }
  });

  it("isUnknownInstructorName matches core", () => {
    for (const name of ["", "Staff", "TBA", "To Be Announced", "tbd", "Ada Lovelace", null]) {
      expect(__test.isUnknownInstructorName(name)).toBe(coreIsUnknown(name));
    }
  });
});
