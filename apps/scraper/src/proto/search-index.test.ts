import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { DescriptionSearchIndex } from "@uoplan/search/descriptionSearch";
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
  // The fixture corpus is tiny (every term has df=1), so keep the full vocabulary
  // to exercise reader behavior; the df band is asserted separately below.
  const index = buildCourseSearchIndex(input, { minDf: 1, maxDf: Number.POSITIVE_INFINITY });
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
    const index = buildCourseSearchIndex(COURSES, { minDf: 1, maxDf: Number.POSITIVE_INFINITY });
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

  it("keeps discriminative mid-frequency terms and drops over-common ones", () => {
    // df: common=3, mid=2, and the per-course singletons (rare/alpha/beta) = 1.
    // A [2, 2] band keeps only "mid" — the discriminative middle term that an
    // older top-K-rarest cap would have dropped in favour of the singletons.
    const corpus: CourseDescriptionInput[] = [
      { code: "aaa1000", title: "One", description: "common rare alpha" },
      { code: "bbb2000", title: "Two", description: "common mid beta" },
      { code: "ccc3000", title: "Three", description: "common mid gamma" },
    ];
    const index = buildCourseSearchIndex(corpus, { minDf: 2, maxDf: 2 });
    const reader = DescriptionSearchIndex.fromBytes(
      DataProto.CourseSearchIndex.encode(index).finish(),
    );
    // Only "mid" survives the band → exactly one dictionary term.
    expect(index.termDfs).toHaveLength(1);
    const midHits = reader.search("mid").map((m) => m.code);
    expect(midHits).toContain("BBB 2000");
    expect(midHits).toContain("CCC 3000");
    // Over-common ("common", df=3 > maxDf) and hapax ("rare", df=1 < minDf) drop out.
    expect(reader.search("common")).toEqual([]);
    expect(reader.search("rare")).toEqual([]);
  });

  it("drops hapax terms with the default df band", () => {
    // "shared" appears twice (df=2, kept); every other term is a per-course hapax
    // (df=1) dropped by the default minDf=2.
    const corpus: CourseDescriptionInput[] = [
      { code: "aaa1000", title: "One", description: "shared alpha" },
      { code: "bbb2000", title: "Two", description: "shared beta" },
    ];
    const index = buildCourseSearchIndex(corpus);
    expect(index.termDfs).toHaveLength(1);
    const reader = DescriptionSearchIndex.fromBytes(
      DataProto.CourseSearchIndex.encode(index).finish(),
    );
    expect(reader.search("shared").map((m) => m.code)).toEqual(
      expect.arrayContaining(["AAA 1000", "BBB 2000"]),
    );
    expect(reader.search("alpha")).toEqual([]);
  });
});
