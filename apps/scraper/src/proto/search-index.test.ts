import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { DescriptionSearchIndex } from "@uoplan/core/search/descriptionSearch";
import { buildCourseSearchIndex } from "./search-index.ts";
import type { CourseDescriptionInput } from "./search-index.ts";

const COURSES: CourseDescriptionInput[] = [
  {
    code: "phy1000",
    title: "Quantum Physics",
    description:
      "Introduction to quantum mechanics: wavefunctions, operators, and the quantum harmonic oscillator.",
  },
  {
    code: "mat2000",
    title: "Linear Algebra",
    description: "Vector spaces, linear transformations, eigenvalues and eigenvectors over fields.",
  },
  {
    code: "csi3000",
    title: "Machine Learning",
    description:
      "Supervised machine learning: regression, classification, neural networks, and gradient descent.",
  },
  {
    // Description identical to the title → excluded from the index entirely.
    code: "gng0000",
    title: "Design Project",
    description: "Design Project",
  },
];

function buildReader(input: CourseDescriptionInput[] = COURSES): DescriptionSearchIndex {
  const index = buildCourseSearchIndex(input, { topK: 6 });
  const bytes = DataProto.CourseSearchIndex.encode(index).finish();
  return DescriptionSearchIndex.fromBytes(bytes);
}

describe("buildCourseSearchIndex", () => {
  it("excludes courses whose description equals their title", () => {
    const reader = buildReader();
    expect(reader.size).toBe(3);
    expect(reader.search("design project")).toEqual([]);
  });

  it("normalizes course codes in the emitted index", () => {
    const index = buildCourseSearchIndex(COURSES, { topK: 6 });
    expect(index.courseCodes).toContain("PHY 1000");
    expect(index.courseCodes).not.toContain("phy1000");
  });

  it("round-trips exact keyword search to the right course", () => {
    const reader = buildReader();
    expect(reader.search("quantum")[0]?.code).toBe("PHY 1000");
    expect(reader.search("eigenvalues")[0]?.code).toBe("MAT 2000");
    expect(reader.search("neural networks")[0]?.code).toBe("CSI 3000");
  });

  it("supports prefix (search-as-you-type) matching", () => {
    // "eigen" is a prefix of both eigenvalue(s) and eigenvector(s) in MAT 2000.
    expect(buildReader().search("eigen")[0]?.code).toBe("MAT 2000");
  });

  it("tolerates a single-character typo", () => {
    // "quantm" is edit distance 1 from "quantum".
    expect(buildReader().search("quantm")[0]?.code).toBe("PHY 1000");
  });

  it("keeps at most topK terms per course", () => {
    const index = buildCourseSearchIndex(COURSES, { topK: 2 });
    // Each course contributes one posting per kept distinct term, so the total
    // posting count cannot exceed topK * covered course count.
    const totalPostings = index.termDfs.reduce((sum, n) => sum + n, 0);
    expect(totalPostings).toBeLessThanOrEqual(2 * index.courseCodes.length);
  });
});
