import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";

import { parseSubjectCourses } from "./parseCourses.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "../__fixtures__");

describe("parseSubjectCourses", () => {
  it("parses CourseLeaf course blocks with aliases, preclusions, and prerequisites", async () => {
    const html = await readFile(join(fixtures, "calendar.courses.COMP.html"), "utf8");
    const result = parseSubjectCourses(html);

    expect(result.courses.length).toBeGreaterThan(70);
    const course = result.courses.find((entry) => entry.code === "COMP 1006");
    expect(course).toMatchObject({
      code: "COMP 1006",
      title: "Introduction to Computer Science II",
      credits: 0.5,
      aliases: ["COMP 1406"],
      prereqText: "COMP 1005 or COMP 1405.",
      prerequisites: {
        type: "or_group",
        children: [
          { type: "course", code: "COMP 1005", text: "COMP 1005" },
          { type: "course", code: "COMP 1405", text: "COMP 1405" },
        ],
      },
    });
    expect(course?.description).toContain("A second course in programming");

    const extras = result.extras.get(normalizeCourseCode("COMP 1006"));
    expect(extras?.precludes).toEqual([
      "BIT 2400",
      "BUSI 2402",
      "ITEC 2400",
      "ITEC 2401",
      "SYSC 2004",
    ]);
    expect(extras?.contactHours).toContain("Lectures three hours a week");
  });

  it("parses archived CourseLeaf course pages", async () => {
    const html = await readFile(
      join(fixtures, "calendar.archive-2014-2015.courses.COMP.html"),
      "utf8",
    );
    const result = parseSubjectCourses(html);

    expect(result.courses.length).toBeGreaterThan(40);
    expect(result.courses.some((course) => course.code === "COMP 2401")).toBe(true);
  });
});
