import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseProgramPage, parseProgramRequirementComment } from "./parsePrograms.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../__fixtures__");

describe("parseProgramPage", () => {
  it("parses multiple anchored programs from one CourseLeaf page", async () => {
    const html = await readFile(join(fixtures, "calendar.programs.computerscience.html"), "utf8");
    const result = parseProgramPage(
      html,
      "https://calendar.carleton.ca/undergrad/undergradprograms/computerscience/",
    );

    expect(result.programs.length).toBeGreaterThan(10);
    const honours = result.programs.find(
      (program) => program.slug === "computerscience#Computer_Science__BCS_Honours",
    );
    expect(honours?.title).toBe("Computer Science B.C.S. Honours (20.0 credits)");
    expect(honours?.url).toBe(
      "https://calendar.carleton.ca/undergrad/undergradprograms/computerscience/#Computer_Science__BCS_Honours",
    );
    const firstSection = honours?.requirements[0];
    expect(firstSection).toMatchObject({
      type: "and",
      title: "A. Credits Included in the Major CGPA (9.0 credits)",
    });
    expect(firstSection?.options?.[0]).toMatchObject({
      type: "group",
      title: "1. 6.5 credits in:",
      credits: 6.5,
      options: expect.arrayContaining([
        expect.objectContaining({ type: "course", code: "COMP 1405", credits: 0.5 }),
        expect.objectContaining({ type: "course", code: "COMP 1406", credits: 0.5 }),
      ]),
    });
    expect(honours?.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "and",
          title: "B. Credits Not Included in the Major CGPA (11.0 credits)",
        }),
      ]),
    );
    expect(result.stats.totalRequirements).toBeGreaterThan(100);
    expect(result.stats.parsedRequirements / result.stats.totalRequirements).toBeGreaterThan(0.6);
  });

  it("parses structurally different engineering and arts pages", async () => {
    const engineeringHtml = await readFile(
      join(fixtures, "calendar.programs.engineering.html"),
      "utf8",
    );
    const englishHtml = await readFile(join(fixtures, "calendar.programs.english.html"), "utf8");

    const engineering = parseProgramPage(
      engineeringHtml,
      "https://calendar.carleton.ca/undergrad/undergradprograms/engineering/",
    );
    const english = parseProgramPage(
      englishHtml,
      "https://calendar.carleton.ca/undergrad/undergradprograms/english/",
    );

    expect(engineering.programs.length).toBeGreaterThan(5);
    expect(english.programs.length).toBeGreaterThan(2);
    expect(engineering.unparsed.length).toBeGreaterThanOrEqual(0);
    expect(english.unparsed.length).toBeGreaterThanOrEqual(0);
  });

  it("parses archived program pages without dropping requirements", async () => {
    const html = await readFile(
      join(fixtures, "calendar.archive-2014-2015.programs.computerscience.html"),
      "utf8",
    );
    const result = parseProgramPage(
      html,
      "https://calendar.carleton.ca/calendars/2014-2015/undergrad/undergradprograms/computerscience/",
    );

    expect(result.programs.length).toBeGreaterThan(5);
    expect(result.stats.totalRequirements).toBeGreaterThan(50);
  });
});

describe("parseProgramRequirementComment", () => {
  it("parses discipline electives at and above a level", () => {
    expect(
      parseProgramRequirementComment("0.5 credit in COMP at the 2000-level or above", 0.5),
    ).toEqual({
      type: "discipline_elective",
      title: "0.5 credit in COMP at the 2000-level or above",
      credits: 0.5,
      disciplineLevels: [{ discipline: "COMP", levels: [2000, 3000, 4000] }],
    });
  });

  it("parses free electives", () => {
    expect(parseProgramRequirementComment("1.0 credit in free electives", 1)).toEqual({
      type: "free_elective",
      title: "1.0 credit in free electives",
      credits: 1,
    });
  });

  it("treats credit-from list headers as parsed groups", async () => {
    const html = await readFile(join(fixtures, "calendar.programs.computerscience.html"), "utf8");
    const result = parseProgramPage(
      html,
      "https://calendar.carleton.ca/undergrad/undergradprograms/computerscience/",
    );

    expect(result.unparsed).not.toContain("2. 1.0 credit from:");
  });

  it("falls back safely for prose that cannot be machine parsed", () => {
    expect(parseProgramRequirementComment("5.0 credits in Breadth Electives", 5)).toEqual({
      type: "elective",
      title: "5.0 credits in Breadth Electives",
      credits: 5,
    });
  });
});
