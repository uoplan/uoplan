import { describe, expect, it } from "vitest";

import { parseCourseDetail } from "./parseCourseDetail.ts";
import { readFixture } from "./testUtils.ts";

describe("parseCourseDetail", () => {
  it("extracts the core course detail fields, restrictions, and meetings", () => {
    const detail = parseCourseDetail(readFixture("display-course.202630.31054.html"));

    expect(detail).toMatchObject({
      crn: "31054",
      courseCode: "COMP 1005",
      subject: "COMP",
      catalogNumber: "1005",
      section: "A",
      longTitle: "Introduction to Computer Science I",
      shortTitle: "Introduc to Computer Science I",
      credits: 0.5,
      scheduleType: "Lecture",
      status: "Open",
    });
    expect(detail.description).toContain("Introduction to computer science and programming");
    expect(detail.sectionInformation).toContain("MIX OF IN-PERSON AND ONLINE SECTION");
    expect(detail.restrictions.level).toEqual(["Graduate Studies and Research (Exclude)"]);
    expect(detail.restrictions.degree).toEqual([
      "Bachelor of Computer Science (Exclude)",
      "Bac of Computer Science Major (Exclude)",
      "Bachelor of Cybersecurity Hon (Exclude)",
      "Bachelor of Data Science Hon (Exclude)",
      "Bachelor of Info. Technology (Exclude)",
    ]);
    expect(detail.meetings).toEqual([
      {
        startDate: "2026-09-09",
        endDate: "2026-12-11",
        days: ["Mo", "We"],
        startMinutes: 515,
        endMinutes: 595,
        schedule: "Lecture",
        instructor: "Robert Collier",
        primary: true,
      },
    ]);
  });

  it("keeps TBA meetings with null times", () => {
    const detail = parseCourseDetail(readFixture("display-course.202630.31055.html"));

    expect(detail.meetings).toEqual([
      {
        startDate: "2026-09-09",
        endDate: "2026-12-11",
        days: [],
        startMinutes: null,
        endMinutes: null,
        schedule: "Tutorial",
        instructor: "Robert Collier",
        primary: true,
      },
    ]);
  });
});
