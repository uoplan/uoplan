import { describe, expect, it } from "vitest";
import {
  explainUnpredictedInstructors,
  explainUnpredictedInstructorsForCourse,
} from "../instructorPredictionExplain";
import type { UnpredictedInstructor } from "../instructorPredictionExplain";
import type {
  ComponentSection,
  CourseGradesSection,
  CourseSchedule,
  MeetingTime,
  PredictedInstructor,
} from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";

const TARGET_TERM = 2271; // Winter 2027 → year 2027

function meeting(overrides: Partial<MeetingTime> = {}): MeetingTime {
  return {
    day: "Mo",
    startMinutes: 600,
    endMinutes: 690,
    virtual: false,
    instructor: null,
    ...overrides,
  };
}

function section(overrides: Partial<ComponentSection> = {}): ComponentSection {
  return {
    section: "A00",
    sectionCode: "A00",
    component: "LEC",
    session: null,
    status: "Open",
    times: [meeting()],
    ...overrides,
  };
}

function course(code: string, sections: ComponentSection[], component = "LEC"): CourseSchedule {
  return {
    subject: code.split(" ")[0] ?? code,
    catalogNumber: code.split(" ")[1] ?? "",
    courseCode: normalizeCourseCode(code),
    title: code,
    timeZone: "America/Toronto",
    components: { [component]: sections },
  };
}

function grades(
  rows: Array<{ name: string; termId: number; legacyId?: number; professorRef?: number }>,
): CourseGradesSection[] {
  return rows.map((r) => ({
    name: r.name,
    termId: r.termId,
    distribution: { A: 1 },
    ...(r.legacyId != null ? { legacyId: r.legacyId } : {}),
    ...(r.professorRef != null ? { professorRef: r.professorRef } : {}),
  }));
}

const CSI = normalizeCourseCode("CSI 2110");

function explain(
  overrides: Partial<Parameters<typeof explainUnpredictedInstructors>[0]> = {},
): UnpredictedInstructor[] {
  return explainUnpredictedInstructors({
    courseCode: CSI,
    section: section(),
    termSchedules: [course("CSI 2110", [section()])],
    termId: TARGET_TERM,
    courseGrades: [],
    predicted: [],
    ...overrides,
  });
}

describe("explainUnpredictedInstructors", () => {
  it("returns nothing when there is no grades history", () => {
    expect(explain({ courseGrades: [] })).toEqual([]);
  });

  it("excludes instructors already in the prediction list", () => {
    const out = explain({
      courseGrades: grades([{ name: "Ada Lovelace", termId: 2261, legacyId: 1 }]),
      predicted: [{ name: "Ada Lovelace", legacyId: 1 }],
    });
    expect(out).toEqual([]);
  });

  it("flags a candidate who last taught before the recency window as stale", () => {
    const out = explain({
      courseGrades: grades([{ name: "Old Prof", termId: 2151, legacyId: 9 }]), // 2015
      recencyYears: 8, // window floor = 2019
    });
    expect(out).toEqual([
      { name: "Old Prof", legacyId: 9, lastYear: 2015, reason: { kind: "stale", lastYear: 2015 } },
    ]);
  });

  it("flags a candidate teaching an overlapping section as a time conflict", () => {
    const out = explain({
      // Busy Prof teaches MAT 1320 Mo 10:00–11:30 in the target term.
      termSchedules: [
        course("CSI 2110", [section({ times: [meeting({ instructor: "Staff" })] })]),
        course("MAT 1320", [
          section({
            section: "Z00",
            sectionCode: "Z00",
            times: [meeting({ instructor: "Busy Prof", startMinutes: 600, endMinutes: 690 })],
          }),
        ]),
      ],
      // Unassigned CSI section meets Mo 10:30–12:00 → overlaps Busy Prof.
      section: section({
        times: [meeting({ instructor: "Staff", startMinutes: 630, endMinutes: 720 })],
      }),
      courseGrades: grades([{ name: "Busy Prof", termId: 2261, legacyId: 2 }]),
    });
    expect(out).toEqual([
      {
        name: "Busy Prof",
        legacyId: 2,
        lastYear: 2026,
        reason: {
          kind: "conflict",
          courseCode: normalizeCourseCode("MAT 1320"),
          component: "LEC",
          section: "Z00",
          day: "Mo",
          startMinutes: 600,
          endMinutes: 690,
        },
      },
    ]);
  });

  it("flags an absent recent prof as inactive when an active candidate exists", () => {
    const out = explain({
      termSchedules: [
        course("CSI 2110", [section({ times: [meeting({ instructor: "Staff" })] })]),
        // Active Prof teaches something (non-overlapping) in the target term.
        course("MAT 1320", [
          section({
            section: "Z00",
            sectionCode: "Z00",
            times: [
              meeting({ instructor: "Active Prof", day: "Fr", startMinutes: 540, endMinutes: 630 }),
            ],
          }),
        ]),
      ],
      // Active Prof is predicted; Absent Prof is recent but not in the term.
      courseGrades: grades([
        { name: "Active Prof", termId: 2261, legacyId: 1 },
        { name: "Absent Prof", termId: 2261, legacyId: 2 },
      ]),
      predicted: [{ name: "Active Prof", legacyId: 1 }],
    });
    expect(out).toEqual([
      { name: "Absent Prof", legacyId: 2, lastYear: 2026, reason: { kind: "inactive" } },
    ]);
  });

  it("flags a recent non-conflicting prof as lowerPriority when nobody is active", () => {
    const out = explain({
      // Only a Staff section exists in the term → nobody active.
      termSchedules: [course("CSI 2110", [section({ times: [meeting({ instructor: "Staff" })] })])],
      courseGrades: grades([{ name: "Recent Prof", termId: 2261, legacyId: 5 }]),
    });
    expect(out).toEqual([
      {
        name: "Recent Prof",
        legacyId: 5,
        lastYear: 2026,
        reason: { kind: "lowerPriority", lastYear: 2026 },
      },
    ]);
  });

  it("orders results conflict → inactive → stale → lowerPriority, then by recency", () => {
    const out = explain({
      termSchedules: [
        course("CSI 2110", [section({ times: [meeting({ instructor: "Staff" })] })]),
        // Conflict prof overlaps the Staff section's Mo 10:00–11:30 slot.
        course("MAT 1320", [
          section({
            section: "Z00",
            sectionCode: "Z00",
            times: [meeting({ instructor: "Conflict Prof", startMinutes: 600, endMinutes: 690 })],
          }),
        ]),
        // Active-but-non-overlapping prof to make inactive classification fire.
        course("PHY 1100", [
          section({
            section: "Y00",
            sectionCode: "Y00",
            times: [
              meeting({ instructor: "Active Prof", day: "Th", startMinutes: 540, endMinutes: 600 }),
            ],
          }),
        ]),
      ],
      courseGrades: grades([
        { name: "Conflict Prof", termId: 2261, legacyId: 1 },
        { name: "Active Prof", termId: 2261, legacyId: 2 },
        { name: "Inactive Prof", termId: 2251, legacyId: 3 }, // 2025, recent, absent
        { name: "Stale Prof", termId: 2151, legacyId: 4 }, // 2015, too old
      ]),
      // Active Prof is the prediction; the rest need explaining.
      predicted: [{ name: "Active Prof", legacyId: 2 }],
    });
    expect(out.map((r) => [r.name, r.reason.kind])).toEqual([
      ["Conflict Prof", "conflict"],
      ["Inactive Prof", "inactive"],
      ["Stale Prof", "stale"],
    ]);
  });

  it("returns nothing for an out-of-range target term", () => {
    expect(
      explain({ termId: 1234, courseGrades: grades([{ name: "Anyone", termId: 2261 }]) }),
    ).toEqual([]);
  });

  it("caps the result count at maxReasons", () => {
    const out = explain({
      courseGrades: grades([
        { name: "P2026", termId: 2261, legacyId: 1 },
        { name: "P2025", termId: 2251, legacyId: 2 },
        { name: "P2024", termId: 2241, legacyId: 3 },
      ]),
      maxReasons: 2,
    });
    expect(out.map((r) => r.name)).toEqual(["P2026", "P2025"]);
  });

  it("merges duplicate grades rows, keeping the most recent year and ids", () => {
    const out = explain({
      courseGrades: grades([
        { name: "Repeat Prof", termId: 2241 }, // 2024, no ids
        { name: "Repeat Prof", termId: 2261, legacyId: 8, professorRef: 3 }, // 2026
      ]),
    });
    expect(out).toEqual([
      {
        name: "Repeat Prof",
        legacyId: 8,
        professorRef: 3,
        lastYear: 2026,
        reason: { kind: "lowerPriority", lastYear: 2026 },
      },
    ]);
  });
});

function predicted(names: string[]): PredictedInstructor[] {
  return names.map((name) => ({ name }));
}

/** Build a CSI course whose sections carry the given predictions. */
function csiCourse(sections: ComponentSection[]): CourseSchedule {
  return course("CSI 2110", sections);
}

describe("explainUnpredictedInstructorsForCourse", () => {
  it("returns nothing when no section has a prediction", () => {
    const csi = csiCourse([section({ times: [meeting({ instructor: "Staff" })] })]);
    expect(
      explainUnpredictedInstructorsForCourse({
        courseCode: CSI,
        course: csi,
        termSchedules: [csi],
        termId: TARGET_TERM,
        courseGrades: grades([{ name: "Anyone", termId: 2261, legacyId: 1 }]),
      }),
    ).toEqual([]);
  });

  it("flags a prof busy at the only unassigned section's time as a conflict", () => {
    const csi = csiCourse([
      section({
        times: [meeting({ instructor: "Staff" })],
        predictedInstructors: predicted(["Active Prof"]),
      }),
    ]);
    const mat = course("MAT 1320", [
      section({
        section: "Z00",
        sectionCode: "Z00",
        times: [meeting({ instructor: "Busy Prof", startMinutes: 600, endMinutes: 690 })],
      }),
    ]);
    const phy = course("PHY 1100", [
      section({
        section: "Y00",
        sectionCode: "Y00",
        times: [
          meeting({ instructor: "Active Prof", day: "Fr", startMinutes: 540, endMinutes: 630 }),
        ],
      }),
    ]);
    const out = explainUnpredictedInstructorsForCourse({
      courseCode: CSI,
      course: csi,
      termSchedules: [csi, mat, phy],
      termId: TARGET_TERM,
      courseGrades: grades([
        { name: "Busy Prof", termId: 2261, legacyId: 2 },
        { name: "Active Prof", termId: 2261, legacyId: 1 },
      ]),
    });
    expect(out).toEqual([
      {
        name: "Busy Prof",
        legacyId: 2,
        lastYear: 2026,
        reason: {
          kind: "conflict",
          courseCode: normalizeCourseCode("MAT 1320"),
          component: "LEC",
          section: "Z00",
          day: "Mo",
          startMinutes: 600,
          endMinutes: 690,
        },
      },
    ]);
  });

  it("keeps the least-blocking reason: conflict in one section but free in another → lowerPriority", () => {
    // Two unassigned CSI sections at different times; Busy Prof overlaps only the first.
    const csi = csiCourse([
      section({
        section: "A00",
        sectionCode: "A00",
        times: [meeting({ instructor: "Staff", startMinutes: 600, endMinutes: 690 })],
        predictedInstructors: predicted(["Active Prof"]),
      }),
      section({
        section: "B00",
        sectionCode: "B00",
        times: [meeting({ instructor: "Staff", startMinutes: 780, endMinutes: 870 })],
        predictedInstructors: predicted(["Active Prof"]),
      }),
    ]);
    // Busy Prof teaches MAT Mo 10:00–11:30 (overlaps A00, not B00) → active in term.
    const mat = course("MAT 1320", [
      section({
        section: "Z00",
        sectionCode: "Z00",
        times: [meeting({ instructor: "Busy Prof", startMinutes: 600, endMinutes: 690 })],
      }),
    ]);
    const phy = course("PHY 1100", [
      section({
        section: "Y00",
        sectionCode: "Y00",
        times: [
          meeting({ instructor: "Active Prof", day: "Fr", startMinutes: 540, endMinutes: 630 }),
        ],
      }),
    ]);
    const out = explainUnpredictedInstructorsForCourse({
      courseCode: CSI,
      course: csi,
      termSchedules: [csi, mat, phy],
      termId: TARGET_TERM,
      courseGrades: grades([
        { name: "Busy Prof", termId: 2261, legacyId: 2 },
        { name: "Active Prof", termId: 2261, legacyId: 1 },
      ]),
    });
    expect(out).toEqual([
      {
        name: "Busy Prof",
        legacyId: 2,
        lastYear: 2026,
        reason: { kind: "lowerPriority", lastYear: 2026 },
      },
    ]);
  });

  it("reports a stale candidate uniformly across sections", () => {
    const csi = csiCourse([
      section({
        section: "A00",
        sectionCode: "A00",
        times: [meeting({ instructor: "Staff", startMinutes: 600, endMinutes: 690 })],
        predictedInstructors: predicted(["Recent Prof"]),
      }),
      section({
        section: "B00",
        sectionCode: "B00",
        times: [meeting({ instructor: "Staff", startMinutes: 780, endMinutes: 870 })],
        predictedInstructors: predicted(["Recent Prof"]),
      }),
    ]);
    const out = explainUnpredictedInstructorsForCourse({
      courseCode: CSI,
      course: csi,
      termSchedules: [csi],
      termId: TARGET_TERM,
      recencyYears: 8, // window floor = 2019
      courseGrades: grades([
        { name: "Recent Prof", termId: 2261, legacyId: 1 },
        { name: "Old Prof", termId: 2151, legacyId: 9 }, // 2015 → stale
      ]),
    });
    expect(out).toEqual([
      { name: "Old Prof", legacyId: 9, lastYear: 2015, reason: { kind: "stale", lastYear: 2015 } },
    ]);
  });

  it("unions predictions across sections so a prof predicted for any section is excluded", () => {
    // A00 predicts X, B00 predicts Y; Z is predicted for neither.
    const csi = csiCourse([
      section({
        section: "A00",
        sectionCode: "A00",
        times: [meeting({ instructor: "Staff", startMinutes: 600, endMinutes: 690 })],
        predictedInstructors: predicted(["Prof X"]),
      }),
      section({
        section: "B00",
        sectionCode: "B00",
        times: [meeting({ instructor: "Staff", startMinutes: 780, endMinutes: 870 })],
        predictedInstructors: predicted(["Prof Y"]),
      }),
    ]);
    const out = explainUnpredictedInstructorsForCourse({
      courseCode: CSI,
      course: csi,
      termSchedules: [csi],
      termId: TARGET_TERM,
      courseGrades: grades([
        { name: "Prof X", termId: 2261, legacyId: 1 },
        { name: "Prof Y", termId: 2261, legacyId: 2 },
        { name: "Prof Z", termId: 2261, legacyId: 3 },
      ]),
    });
    // Both X and Y are excluded by the union; only Z needs explaining.
    expect(out).toEqual([
      {
        name: "Prof Z",
        legacyId: 3,
        lastYear: 2026,
        reason: { kind: "lowerPriority", lastYear: 2026 },
      },
    ]);
  });

  it("returns nothing for an out-of-range target term", () => {
    const csi = csiCourse([
      section({
        times: [meeting({ instructor: "Staff" })],
        predictedInstructors: predicted(["Active Prof"]),
      }),
    ]);
    expect(
      explainUnpredictedInstructorsForCourse({
        courseCode: CSI,
        course: csi,
        termSchedules: [csi],
        termId: 1234,
        courseGrades: grades([{ name: "Anyone", termId: 2261, legacyId: 1 }]),
      }),
    ).toEqual([]);
  });
});
