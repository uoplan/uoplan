import { describe, expect, it } from "vitest";
import {
  isUnknownInstructorName,
  knownSectionInstructors,
  sectionInstructors,
} from "../instructorPrediction";
import { fromProtoSchedulesData, toProtoSchedulesData } from "../dataTypes/schedules";
import { distributionForSection } from "../gradeLookup";
import type { ComponentSection, GradeDistribution, SchedulesData } from "../dataTypes";

function section(overrides: Partial<ComponentSection> = {}): ComponentSection {
  return {
    section: "A00",
    sectionCode: "A00",
    component: "LEC",
    session: null,
    status: "Open",
    times: [{ day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false, instructor: null }],
    ...overrides,
  };
}

describe("isUnknownInstructorName", () => {
  it("treats placeholders and blanks as unknown", () => {
    for (const name of [
      "",
      "  ",
      "Staff",
      "STAFF",
      "TBA",
      "To Be Announced",
      "tbd",
      null,
      undefined,
    ]) {
      expect(isUnknownInstructorName(name)).toBe(true);
    }
  });

  it("treats real names as known", () => {
    expect(isUnknownInstructorName("Ada Lovelace")).toBe(false);
    expect(isUnknownInstructorName("Frédéric Côté")).toBe(false);
  });
});

describe("knownSectionInstructors", () => {
  it("returns distinct real instructor names and drops placeholders", () => {
    const s = section({
      times: [
        {
          day: "Mo",
          startMinutes: 600,
          endMinutes: 690,
          virtual: false,
          instructor: "Ada Lovelace",
        },
        {
          day: "We",
          startMinutes: 600,
          endMinutes: 690,
          virtual: false,
          instructor: "Ada Lovelace",
        },
        { day: "Fr", startMinutes: 600, endMinutes: 690, virtual: false, instructor: "Staff" },
      ],
    });
    expect(knownSectionInstructors(s)).toEqual(["Ada Lovelace"]);
  });
});

describe("sectionInstructors", () => {
  it("reports known instructors when assigned", () => {
    const s = section({
      times: [
        {
          day: "Mo",
          startMinutes: 600,
          endMinutes: 690,
          virtual: false,
          instructor: "Grace Hopper",
        },
      ],
      predictedInstructors: [{ name: "Should Be Ignored", legacyId: 1 }],
    });
    expect(sectionInstructors(s)).toEqual({ kind: "known", names: ["Grace Hopper"] });
  });

  it("reports the prediction guess when unassigned", () => {
    const s = section({
      times: [
        { day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false, instructor: "Staff" },
      ],
      predictedInstructors: [{ name: "Ada Lovelace", legacyId: 7 }],
    });
    expect(sectionInstructors(s)).toEqual({
      kind: "unknown",
      guess: [{ name: "Ada Lovelace", legacyId: 7 }],
    });
  });

  it("reports an empty guess when unassigned with no prediction", () => {
    expect(sectionInstructors(section())).toEqual({ kind: "unknown", guess: [] });
  });
});

describe("schedules proto round-trip carries predictedInstructors", () => {
  it("preserves predictions through encode/decode", () => {
    const data: SchedulesData = {
      termId: "2271",
      schedules: [
        {
          subject: "CSI",
          catalogNumber: "2110",
          courseCode: "CSI 2110",
          title: "Data Structures",
          timeZone: "America/Toronto",
          components: {
            LEC: [
              section({
                section: "A00-LEC",
                times: [
                  {
                    day: "Mo",
                    startMinutes: 600,
                    endMinutes: 690,
                    virtual: false,
                    instructor: "Staff",
                  },
                ],
                predictedInstructors: [
                  { name: "Ada Lovelace", legacyId: 7 },
                  { name: "Grace Hopper" },
                ],
              }),
              section({
                section: "B00-LEC",
                times: [
                  {
                    day: "Tu",
                    startMinutes: 600,
                    endMinutes: 690,
                    virtual: false,
                    instructor: "Alan Turing",
                  },
                ],
              }),
            ],
          },
        },
      ],
    };

    const decoded = fromProtoSchedulesData(toProtoSchedulesData(data));
    const sections = decoded.schedules[0]!.components.LEC!;
    expect(sections[0]!.predictedInstructors).toEqual([
      { name: "Ada Lovelace", legacyId: 7 },
      { name: "Grace Hopper", legacyId: null },
    ]);
    // Known-instructor sections carry no predictions.
    expect(sections[1]!.predictedInstructors).toBeUndefined();
  });
});

describe("predictions are informational only", () => {
  it("grade lookups never match a predicted instructor name", () => {
    const profMap = new Map<string, GradeDistribution>([["ada lovelace", { "A+": 50, A: 20 }]]);
    const aggregate: GradeDistribution = { "A+": 1, F: 1 };

    // A section whose only "instructor" is the Staff placeholder must fall back
    // to the course aggregate — never to the predicted prof's distribution.
    const result = distributionForSection(["Staff"], profMap, aggregate);
    expect(result.kind).toBe("fallback");
    expect(result.distribution).toEqual(aggregate);
  });
});
