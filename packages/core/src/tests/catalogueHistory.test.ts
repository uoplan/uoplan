import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { reconstructCatalogueForYear, toProtoCatalogue } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";
import type { Catalogue } from "../dataTypes";

// Union of all courses with their latest metadata. CSI 2110's latest (baseline)
// prerequisite is MAT 1320; MAT 1300 is a discontinued course kept in the union.
const union: Catalogue = {
  courses: [
    {
      code: normalizeCourseCode("CSI 2110"),
      title: "Data Structures",
      credits: 3,
      description: "",
      prerequisites: { type: "course", code: normalizeCourseCode("MAT 1320") },
    },
    { code: normalizeCourseCode("MAT 1320"), title: "Calculus I", credits: 3, description: "" },
    {
      code: normalizeCourseCode("MAT 1300"),
      title: "Calculus I (old)",
      credits: 3,
      description: "",
    },
  ],
  programs: [],
};

function courseNode(code: string): DataProto.CoursePrereqNode {
  return {
    type: DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_COURSE,
    code: normalizeCourseCode(code),
    disciplines: [],
    levels: [],
    disciplineLevels: [],
    programs: [],
    children: [],
  };
}

const unionProto = toProtoCatalogue(union);

// In 2024 CSI 2110 required MAT 1300; the 2025 revision has no prerequisite.
// `code: 0` = CSI 2110, the first entry in the union course_codes table.
const history: DataProto.CataloguePrereqHistory = {
  years: [2024, 2025, 2026],
  overlays: [
    {
      code: 0,
      revisions: [
        { yearMask: 0b001, prerequisites: courseNode("MAT 1300"), hasPrereqText: false },
        { yearMask: 0b010, prerequisites: undefined, hasPrereqText: true },
      ],
    },
  ],
};

function prereqCodeFor(catalogue: Catalogue, code: string): string | undefined {
  const c = catalogue.courses.find((x) => x.code === normalizeCourseCode(code));
  return c?.prerequisites?.code;
}

describe("reconstructCatalogueForYear", () => {
  it("applies a cohort year's prerequisite revision from the overlay", () => {
    const y2024 = reconstructCatalogueForYear(unionProto, history, 2024);
    expect(prereqCodeFor(y2024, "CSI 2110")).toBe(normalizeCourseCode("MAT 1300"));
  });

  it("clears prerequisites when a revision has none (and mirrors has_prereq_text)", () => {
    const y2025 = reconstructCatalogueForYear(unionProto, history, 2025);
    const csi = y2025.courses.find((c) => c.code === normalizeCourseCode("CSI 2110"));
    expect(csi?.prerequisites).toBeUndefined();
    expect(csi?.prereqText).toBeDefined();
  });

  it("returns the union baseline for the latest year (no revision references it)", () => {
    const y2026 = reconstructCatalogueForYear(unionProto, history, 2026);
    expect(prereqCodeFor(y2026, "CSI 2110")).toBe(normalizeCourseCode("MAT 1320"));
  });

  it("returns the union baseline for an untracked year or null history", () => {
    expect(prereqCodeFor(reconstructCatalogueForYear(unionProto, history, 1999), "CSI 2110")).toBe(
      normalizeCourseCode("MAT 1320"),
    );
    expect(prereqCodeFor(reconstructCatalogueForYear(unionProto, null, 2024), "CSI 2110")).toBe(
      normalizeCourseCode("MAT 1320"),
    );
  });

  it("keeps every union course regardless of the cohort year", () => {
    const y2024 = reconstructCatalogueForYear(unionProto, history, 2024);
    expect(y2024.courses.map((c) => c.code)).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("MAT 1320"),
      normalizeCourseCode("MAT 1300"),
    ]);
  });
});
