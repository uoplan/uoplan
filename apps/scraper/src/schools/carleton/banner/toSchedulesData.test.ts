import { describe, expect, it } from "vitest";

import { parseCourseSearch } from "./parseCourseSearch.ts";
import { buildLinkGraph, toSchedulesData } from "./toSchedulesData.ts";
import { readFixture } from "./testUtils.ts";

describe("toSchedulesData", () => {
  it("groups Carleton sections into the shared SchedulesData shape", () => {
    const sections = parseCourseSearch(readFixture("course-search.202630.COMP.html")).filter(
      (section) => ["31054", "31055", "31056", "31057"].includes(section.crn),
    );
    const data = toSchedulesData("202630", sections);

    expect(data.termId).toBe("202630");
    expect(data.totalCourses).toBe(1);
    expect(data.totalWithSchedules).toBe(1);
    expect(data.schedules).toHaveLength(1);
    expect(data.schedules[0]).toMatchObject({
      subject: "COMP",
      catalogNumber: "1005",
      courseCode: "COMP 1005",
      title: "Introduc to Computer Science I",
      timeZone: "America/Toronto",
    });
    expect(Object.keys(data.schedules[0]!.components).sort()).toEqual(["LEC", "TUT"]);
    expect(data.schedules[0]!.components.LEC[0]).toMatchObject({
      section: "A-LEC",
      sectionCode: "A",
      component: "LEC",
      session: null,
      status: "Open",
    });
    expect(data.schedules[0]!.components.LEC[0]!.times).toEqual([
      {
        day: "Mo",
        startMinutes: 515,
        endMinutes: 595,
        virtual: true,
        instructor: "Robert Collier",
        meetingDates: ["2026-09-09", "2026-12-11"],
      },
      {
        day: "We",
        startMinutes: 515,
        endMinutes: 595,
        virtual: true,
        instructor: "Robert Collier",
        meetingDates: ["2026-09-09", "2026-12-11"],
      },
    ]);
    expect(data.schedules[0]!.components.TUT[0]!.times).toEqual([]);
  });
});

describe("buildLinkGraph", () => {
  it("exports CRN keyed linked-section metadata outside the shared schedule type", () => {
    const sections = parseCourseSearch(readFixture("course-search.202630.COMP.html")).filter(
      (section) => ["31054", "31055"].includes(section.crn),
    );

    expect(buildLinkGraph(sections)).toEqual({
      "31054": {
        crn: "31054",
        courseCode: "COMP 1005",
        section: "A",
        linkedGroups: [{ alternatives: [{ courseCode: "COMP 1005", section: "A1" }] }],
      },
      "31055": {
        crn: "31055",
        courseCode: "COMP 1005",
        section: "A1",
        linkedGroups: [{ alternatives: [{ courseCode: "COMP 1005", section: "A" }] }],
      },
    });
  });
});
