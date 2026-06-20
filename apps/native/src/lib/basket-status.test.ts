import type { Catalogue, Course, DisciplinesData, SchedulesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { buildBasketStatusCache, getBasketCourseStatus } from "./basket-status";

const DISCIPLINES: DisciplinesData = { disciplines: [], faculties: [] };
const SCHEDULES: SchedulesData = { termId: "202601", schedules: [] };

function makeCourse(
  partial: { code: string; title: string } & Partial<Omit<Course, "code" | "title">>,
): Course {
  return {
    credits: 3,
    description: "",
    ...partial,
    code: normalizeCourseCode(partial.code),
  };
}

function makeCache(courses: Course[]) {
  const catalogue: Catalogue = { courses, programs: [] };
  return buildBasketStatusCache(catalogue, SCHEDULES, DISCIPLINES);
}

describe("getBasketCourseStatus", () => {
  it("does not flag prerequisites when a completed course satisfies them", () => {
    const cache = makeCache([
      makeCourse({ code: "AAA 1000", title: "Introductory course" }),
      makeCourse({
        code: "BBB 2000",
        title: "Follow-up course",
        prerequisites: { type: "course", code: "AAA 1000" },
      }),
    ]);

    const status = getBasketCourseStatus({
      course: { code: "BBB 2000", termIds: [] },
      completedCodes: ["AAA 1000"],
      cache,
    });

    expect(status.prerequisite).toBe("met");
    expect(status.badges.map((badge) => badge.label)).not.toContain("Prerequisites not met");
  });

  it("flags prerequisites when the completed courses do not satisfy them", () => {
    const cache = makeCache([
      makeCourse({ code: "AAA 1000", title: "Introductory course" }),
      makeCourse({
        code: "BBB 2000",
        title: "Follow-up course",
        prerequisites: { type: "course", code: "AAA 1000" },
      }),
    ]);

    const status = getBasketCourseStatus({
      course: { code: "BBB 2000", termIds: [] },
      completedCodes: [],
      cache,
      hasProfileContext: true,
    });

    expect(status.prerequisite).toBe("not_met");
    expect(status.badges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "prerequisite", label: "Prerequisites not met" }),
      ]),
    );
  });

  it("does not flag prerequisites without any academic context (no program/year, empty completed set)", () => {
    const cache = makeCache([
      makeCourse({ code: "AAA 1000", title: "Introductory course" }),
      makeCourse({
        code: "BBB 2000",
        title: "Follow-up course",
        prerequisites: { type: "course", code: "AAA 1000" },
      }),
    ]);

    const status = getBasketCourseStatus({
      course: { code: "BBB 2000", termIds: [] },
      completedCodes: [],
      cache,
      hasProfileContext: false,
    });

    expect(status.prerequisite).toBe("unknown");
    expect(status.badges.map((badge) => badge.label)).not.toContain("Prerequisites not met");
  });

  it("flags prerequisites without a profile once a completed course is present", () => {
    const cache = makeCache([
      makeCourse({ code: "AAA 1000", title: "Introductory course" }),
      makeCourse({ code: "CCC 3000", title: "Unrelated course" }),
      makeCourse({
        code: "BBB 2000",
        title: "Follow-up course",
        prerequisites: { type: "course", code: "AAA 1000" },
      }),
    ]);

    const status = getBasketCourseStatus({
      course: { code: "BBB 2000", termIds: [] },
      completedCodes: ["CCC 3000"],
      cache,
      hasProfileContext: false,
    });

    expect(status.prerequisite).toBe("not_met");
  });

  it("does not flag offering status when the selected term is offered", () => {
    const cache = makeCache([makeCourse({ code: "BBB 2000", title: "Follow-up course" })]);

    const status = getBasketCourseStatus({
      course: { code: "BBB 2000", termIds: ["202601"] },
      completedCodes: [],
      cache,
      selectedTermId: "202601",
      termNameById: new Map([["202601", "Winter 2026"]]),
    });

    expect(status.offering).toBe("offered");
    expect(status.badges.some((badge) => badge.kind === "offering")).toBe(false);
  });

  it("flags offering status when the selected term is not offered", () => {
    const cache = makeCache([makeCourse({ code: "BBB 2000", title: "Follow-up course" })]);

    const status = getBasketCourseStatus({
      course: { code: "BBB 2000", termIds: ["202601"] },
      completedCodes: [],
      cache,
      selectedTermId: "202509",
      termNameById: new Map([["202509", "Fall 2025"]]),
    });

    expect(status.offering).toBe("not_offered");
    expect(status.badges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "offering", label: "Not offered in Fall 2025" }),
      ]),
    );
  });
});
