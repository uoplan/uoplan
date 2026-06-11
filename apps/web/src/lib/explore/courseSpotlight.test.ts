import { describe, expect, it } from "vitest";
import {
  buildCourseSpotlightIndex,
  gradedHeadcount,
  pickSpotlightVariant,
  pickSpotlightVariants,
  rankCoursesForSpotlight,
  SPOTLIGHT_MIN_GRADED_COUNT,
  SPOTLIGHT_VARIANTS,
  type CourseSpotlightVariant,
} from "./courseSpotlight";
import {
  buildCourseSearchEntries,
  buildOfferingsByCourseNorm,
  type ExploreOfferingFlat,
} from "./gradesSearch";
import { testCourseCode, testProfessorName } from "../../test/brands";

/** Build the spotlight index from flat offerings the way the runtime context does. */
function spotlightIndexFrom(
  offerings: ExploreOfferingFlat[],
  titleByCode: Map<string, string> = new Map(),
) {
  const offeringsByCourseNorm = buildOfferingsByCourseNorm(offerings);
  const entryByNorm = new Map(
    buildCourseSearchEntries(offerings, titleByCode).map((e) => [e.normCode, e]),
  );
  return buildCourseSpotlightIndex(offeringsByCourseNorm, entryByNorm);
}

function distWithMass(mass: number, gpaHint: "high" | "low" | "fail"): Record<string, number> {
  if (gpaHint === "high") {
    return { A: mass };
  }
  if (gpaHint === "low") {
    return { F: mass };
  }
  return { F: Math.floor(mass * 0.5), E: mass - Math.floor(mass * 0.5) };
}

type OfferingPartial = Partial<Omit<ExploreOfferingFlat, "courseCode" | "professorName">> & {
  courseCode?: string;
  professorName?: string;
};

function sampleOffering(partial: OfferingPartial): ExploreOfferingFlat {
  const defaults: ExploreOfferingFlat = {
    id: "id",
    courseCode: testCourseCode("CSI 2110"),
    courseTitle: "Data Structures",
    professorName: testProfessorName("Ada Lovelace"),
    termId: 2251,
    termLabel: "Fall 2025",
    fuseText: "",
    distribution: { A: SPOTLIGHT_MIN_GRADED_COUNT },
  };
  return {
    ...defaults,
    ...partial,
    courseCode: testCourseCode(partial.courseCode ?? defaults.courseCode),
    professorName: testProfessorName(partial.professorName ?? defaults.professorName),
    fuseText: partial.fuseText ?? defaults.fuseText,
  };
}

describe("pickSpotlightVariant", () => {
  it("returns a valid variant from rng", () => {
    const variants = new Set<CourseSpotlightVariant>();
    for (let i = 0; i < 20; i++) {
      variants.add(pickSpotlightVariant(() => (i * 0.17) % 1));
    }
    expect(variants.size).toBeGreaterThan(1);
  });
});

describe("pickSpotlightVariants", () => {
  it("returns distinct variants", () => {
    const picked = pickSpotlightVariants(3, () => 0.1);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    for (const v of picked) {
      expect(SPOTLIGHT_VARIANTS).toContain(v);
    }
  });
});

describe("gradedHeadcount", () => {
  it("excludes pass/fail-only grades", () => {
    expect(gradedHeadcount({ P: 100, S: 50 })).toBe(0);
    expect(gradedHeadcount({ A: 10, P: 5 })).toBe(10);
  });
});

describe("buildCourseSpotlightIndex", () => {
  it("drops courses below minimum graded count", () => {
    const index = spotlightIndexFrom([
      sampleOffering({
        id: "small",
        courseCode: "MAT 1341",
        distribution: { A: SPOTLIGHT_MIN_GRADED_COUNT - 1 },
      }),
      sampleOffering({
        id: "big",
        courseCode: "CSI 2110",
        distribution: { A: SPOTLIGHT_MIN_GRADED_COUNT },
      }),
    ]);
    expect(index.size).toBe(1);
    expect(index.has("CSI 2110")).toBe(true);
  });
});

describe("rankCoursesForSpotlight", () => {
  const titleByCode = new Map<string, string>();

  function buildIndex(offerings: ExploreOfferingFlat[]) {
    return spotlightIndexFrom(offerings, titleByCode);
  }

  function basicDifficultyIndex() {
    const mass = SPOTLIGHT_MIN_GRADED_COUNT;
    return buildIndex([
      sampleOffering({
        id: "easy",
        courseCode: "MAT 1341",
        distribution: distWithMass(mass, "high"),
      }),
      sampleOffering({
        id: "hard",
        courseCode: "PHY 2336",
        distribution: distWithMass(mass, "low"),
      }),
    ]);
  }

  it("ranks hardest by lowest GPA", () => {
    const index = basicDifficultyIndex();
    const ranked = rankCoursesForSpotlight(index, "hardest", 2);
    expect(ranked[0]?.entry.courseCode).toBe("PHY 2336");
    expect(ranked[0]?.stat).toEqual({ kind: "gpa", value: expect.any(Number) });
    expect(ranked[0].stat.kind === "gpa" && ranked[0].stat.value).toBeLessThan(1);
  });

  it("ranks easiest by highest GPA", () => {
    const index = basicDifficultyIndex();
    const ranked = rankCoursesForSpotlight(index, "easiest", 2);
    expect(ranked[0]?.entry.courseCode).toBe("MAT 1341");
  });

  it("ranks highestFailRate by fail share", () => {
    const mass = SPOTLIGHT_MIN_GRADED_COUNT;
    const index = buildIndex([
      sampleOffering({
        id: "low-fail",
        courseCode: "MAT 1341",
        distribution: { A: mass },
      }),
      sampleOffering({
        id: "high-fail",
        courseCode: "PHY 2336",
        distribution: distWithMass(mass, "fail"),
      }),
    ]);
    const ranked = rankCoursesForSpotlight(index, "highestFailRate", 2);
    expect(ranked[0]?.entry.courseCode).toBe("PHY 2336");
    expect(ranked[0]?.stat.kind).toBe("failRate");
  });

  it("ranks mostProfessors by distinct instructor groups", () => {
    const mass = SPOTLIGHT_MIN_GRADED_COUNT;
    const dist = { A: mass };
    const index = buildIndex([
      sampleOffering({
        id: "a1",
        courseCode: "CSI 2110",
        professorName: testProfessorName("Prof A"),
        legacyId: 1,
        distribution: { A: 20 },
      }),
      sampleOffering({
        id: "a2",
        courseCode: "CSI 2110",
        professorName: testProfessorName("Prof B"),
        legacyId: 2,
        distribution: { A: 20 },
      }),
      sampleOffering({
        id: "b1",
        courseCode: "MAT 1341",
        professorName: testProfessorName("Prof C"),
        legacyId: 3,
        distribution: dist,
      }),
    ]);
    const ranked = rankCoursesForSpotlight(index, "mostProfessors", 2);
    expect(ranked[0]?.entry.courseCode).toBe("CSI 2110");
    expect(ranked[0]?.stat).toEqual({ kind: "professorCount", value: 2 });
  });
});
