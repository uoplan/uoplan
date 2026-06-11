import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseSearchResultsHtml } from "./scrape.ts";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const subjectSearchItiHtml = readFileSync(
  path.join(fixtureDir, "subject-search-ITI.html"),
  "utf-8",
);

describe("parseSearchResultsHtml", () => {
  it("parses every course in a subject-level (multi-course) response", () => {
    const schedules = parseSearchResultsHtml(subjectSearchItiHtml, false);
    expect(schedules.map((s) => s.courseCode)).toEqual(["ITI 1120", "ITI 1520"]);
  });

  it("associates each course with its own title, components and sections", () => {
    const schedules = parseSearchResultsHtml(subjectSearchItiHtml, false);
    const byCode = new Map(schedules.map((s) => [s.courseCode, s]));

    const iti1120 = byCode.get("ITI 1120");
    expect(iti1120).toBeDefined();
    expect(iti1120!.subject).toBe("ITI");
    expect(iti1120!.catalogNumber).toBe("1120");
    expect(iti1120!.title).toBe("Introduction to Computing I");
    expect(Object.keys(iti1120!.components).sort()).toEqual(["LAB", "LEC"]);
    expect(iti1120!.components.LEC.length).toBe(4);
    expect(iti1120!.components.LAB.length).toBe(16);

    const iti1520 = byCode.get("ITI 1520");
    expect(iti1520).toBeDefined();
    expect(iti1520!.title).toBe("Introduction à l'informatique I");
    // Distinct course → distinct section counts, proving tables are not bled across courses.
    expect(iti1520!.components.LEC.length).toBe(3);
    expect(iti1520!.components.LAB.length).toBe(10);
  });

  it("parses meeting times for sections", () => {
    const schedules = parseSearchResultsHtml(subjectSearchItiHtml, false);
    const iti1120 = schedules.find((s) => s.courseCode === "ITI 1120")!;
    const lecA00 = iti1120.components.LEC.find((s) => s.sectionCode === "A00");
    expect(lecA00).toBeDefined();
    expect(lecA00!.component).toBe("LEC");
    expect(lecA00!.times.length).toBeGreaterThan(0);
    for (const t of lecA00!.times) {
      expect(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]).toContain(t.day);
      expect(t.endMinutes).toBeGreaterThan(t.startMinutes);
      expect(t.virtual).toBe(false);
    }
  });

  it("marks sections virtual when the virtual flag is set", () => {
    const schedules = parseSearchResultsHtml(subjectSearchItiHtml, true);
    const allTimes = schedules
      .flatMap((s) => Object.values(s.components))
      .flat()
      .flatMap((sec) => sec.times);
    expect(allTimes.length).toBeGreaterThan(0);
    expect(allTimes.every((t) => t.virtual === true)).toBe(true);
  });

  it("returns an empty array for a response with no course headers", () => {
    expect(parseSearchResultsHtml("<html><body>nothing here</body></html>", false)).toEqual([]);
  });
});
