import { describe, expect, it } from "vitest";

import {
  buildFrenchFallbackImportantDates,
  parseCarletonImportantDates,
} from "./importantDates.ts";

const FIXTURE = `
  <table>
    <tr><td>FALL TERM 2026</td><td></td></tr>
    <tr><td>September 9, 2026</td><td>Fall term begins. Fall classes begin.</td></tr>
    <tr><td>October 12, 2026</td><td>Statutory holiday. University closed.</td></tr>
    <tr><td>December 11, 2026</td><td>Fall term ends. Last day of fall classes.</td></tr>
    <tr><td>WINTER TERM 2027</td><td></td></tr>
    <tr><td>January 6, 2027</td><td>Winter term begins. Winter classes begin.</td></tr>
    <tr><td>April 12-24, 2027</td><td>Final examinations in winter term courses will be held.</td></tr>
  </table>
`;

describe("parseCarletonImportantDates", () => {
  it("builds important-dates data from the CourseLeaf academic year table", () => {
    const data = parseCarletonImportantDates(FIXTURE, "https://calendar.carleton.ca/academicyear/");

    expect(data.locale).toBe("en");
    expect(data.terms.map((term) => term.label)).toEqual(["Fall 2026", "Winter 2027"]);
    expect(data.terms[0]).toMatchObject({
      sourceId: "carleton-fall-2026",
      termId: "202630",
      season: "fall",
      year: 2026,
      termInterval: { startDate: "2026-09-01", endDate: "2026-12-31" },
      courseInterval: { startDate: "2026-09-09", endDate: "2026-12-11" },
    });
    expect(data.terms[0]!.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "overview" }),
        expect.objectContaining({ category: "breaks" }),
      ]),
    );
    expect(
      data.terms[1]!.sections.find((section) => section.category === "grades_exams")?.groups[0]
        ?.items[0],
    ).toMatchObject({
      dateText: "April 12-24, 2027",
      interval: { startDate: "2027-04-12", endDate: "2027-04-24" },
      effect: "deadline",
    });
  });

  it("clones English data into a French-locale fallback for Carleton", () => {
    const en = parseCarletonImportantDates(FIXTURE, "https://calendar.carleton.ca/academicyear/");
    const fr = buildFrenchFallbackImportantDates(en);

    expect(fr).toEqual({
      ...en,
      locale: "fr-CA",
    });
    expect(fr.terms[0]!.sections[0]!.groups[0]!.items[0]!.topic).toBe(
      en.terms[0]!.sections[0]!.groups[0]!.items[0]!.topic,
    );
  });
});
