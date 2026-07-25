import { describe, expect, it } from "vitest";

import { parseAlsoRegisterIn, parseCourseSearch } from "./parseCourseSearch.ts";
import { readFixture } from "./testUtils.ts";

describe("parseAlsoRegisterIn", () => {
  it("parses a single required linked section", () => {
    expect(parseAlsoRegisterIn("COMP 1005 A1")).toEqual([
      { alternatives: [{ courseCode: "COMP 1005", section: "A1" }] },
    ]);
  });

  it("inherits the course code across alternatives", () => {
    expect(parseAlsoRegisterIn("MATH 0005 A1 or A2 or A3")).toEqual([
      {
        alternatives: [
          { courseCode: "MATH 0005", section: "A1" },
          { courseCode: "MATH 0005", section: "A2" },
          { courseCode: "MATH 0005", section: "A3" },
        ],
      },
    ]);
  });

  it("splits separate required components on and", () => {
    expect(
      parseAlsoRegisterIn(
        "CHEM 1001 A1 or A2 or A3 or A4 or A5 or A6 or A7 or G1 and CHEM 1001 ATU",
      ),
    ).toEqual([
      {
        alternatives: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "G1"].map((section) => ({
          courseCode: "CHEM 1001",
          section,
        })),
      },
      { alternatives: [{ courseCode: "CHEM 1001", section: "ATU" }] },
    ]);
  });
});

describe("parseCourseSearch", () => {
  it("parses primary rows, details, links, and online/TBA sections", () => {
    const sections = parseCourseSearch(readFixture("course-search.202630.COMP.html"));

    expect(sections).toHaveLength(146);
    expect(sections[0]).toMatchObject({
      crn: "31054",
      courseCode: "COMP 1005",
      subject: "COMP",
      catalogNumber: "1005",
      section: "A",
      title: "Introduc to Computer Science I",
      credits: 0.5,
      scheduleType: "Lecture",
      status: "Open",
      instructor: "Robert Collier",
      detailUrl: "bwysched.p_display_course?wsea_code=EXT&term_code=202630&disp=26061541&crn=31054",
      virtual: true,
    });
    expect(sections[0]!.meetings).toEqual([
      {
        days: ["Mo", "We"],
        startMinutes: 515,
        endMinutes: 595,
        startDate: "2026-09-09",
        endDate: "2026-12-11",
      },
    ]);
    expect(sections[0]!.linkedGroups).toEqual([
      { alternatives: [{ courseCode: "COMP 1005", section: "A1" }] },
    ]);

    const tutorial = sections.find((section) => section.crn === "31055");
    expect(tutorial).toMatchObject({ section: "A1", credits: 0, scheduleType: "Tutorial" });
    expect(tutorial!.meetings).toEqual([
      {
        days: [],
        startMinutes: null,
        endMinutes: null,
        startDate: "2026-09-09",
        endDate: "2026-12-11",
      },
    ]);
  });

  it("keeps full sections that do not have a select checkbox", () => {
    const sections = parseCourseSearch(readFixture("course-search.202630.MATH.html"));
    const full = sections.find((section) => section.crn === "33061");

    expect(full).toMatchObject({
      courseCode: "MATH 1004",
      section: "A",
      status: "Full, No Waitlist",
      instructor: "Angelo Mingarelli",
    });
  });

  it("parses complex Chemistry linked-section rules", () => {
    const sections = parseCourseSearch(readFixture("course-search.202630.CHEM.html"));
    const chem1001A = sections.find((section) => section.crn === "30831");

    expect(chem1001A!.linkedGroups).toEqual([
      {
        alternatives: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "G1"].map((section) => ({
          courseCode: "CHEM 1001",
          section,
        })),
      },
      { alternatives: [{ courseCode: "CHEM 1001", section: "ATU" }] },
    ]);
  });

  it("preserves cross-registered campus information", () => {
    const sections = parseCourseSearch(readFixture("course-search.202630.SYSC.html"));

    expect(
      sections.some((section) =>
        section.sectionInformation?.includes("Campus: University of Ottawa"),
      ),
    ).toBe(true);
  });
});
