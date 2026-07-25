import { describe, expect, it } from "vitest";

import { parseCarletonDisciplines } from "./disciplines.ts";
import { readFixture } from "./banner/testUtils.ts";

describe("parseCarletonDisciplines", () => {
  it("extracts CourseLeaf subject rows, expands multi-code labels, and attaches known faculties", () => {
    const result = parseCarletonDisciplines(readFixture("calendar.courses-index.html"));

    expect(result.sources).toEqual(["https://calendar.carleton.ca/undergrad/courses/"]);
    expect(result.count).toBeGreaterThan(100);
    expect(result.faculties).toEqual(
      expect.arrayContaining([
        { id: "engineering-and-design", name: "Faculty of Engineering and Design" },
        { id: "sprott-school-of-business", name: "Sprott School of Business" },
      ]),
    );
    expect(result.disciplines).toEqual(
      expect.arrayContaining([
        {
          code: "AERO",
          name: "Aerospace Engineering",
          faculty: "engineering-and-design",
        },
        {
          code: "ARCS",
          name: "Architecture",
          faculty: "engineering-and-design",
        },
        {
          code: "BUSI",
          name: "Business",
          faculty: "sprott-school-of-business",
        },
        {
          code: "COMP",
          name: "Computer Science",
          faculty: "science",
        },
      ]),
    );
  });
});
