import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import {
  buildCourseDescriptionShards,
  buildShardIdsFromDisciplines,
  collectLatestCourseDescriptions,
  COURSE_DESCRIPTION_SHARD_IDS,
} from "./description-shards.ts";
import type { CourseDescriptionShardId } from "./description-shards.ts";
import type { CatalogueJsonInput } from "./catalogue.ts";

// Minimal DisciplinesData that maps MAT → science, ZZZ → unmapped.
function makeTestDisciplines(): DataProto.DisciplinesData {
  return {
    faculties: [
      { name: "Faculty of Science", nameFr: "Faculté des sciences" },
      { name: "Faculty of Arts", nameFr: "Faculté des arts" },
    ],
    disciplines: [
      { code: "MAT", name: "Mathematics", nameFr: "Mathématiques", facultyRef: 1 },
      { code: "PHI", name: "Philosophy", nameFr: "Philosophie", facultyRef: 2 },
    ],
  };
}

describe("COURSE_DESCRIPTION_SHARD_IDS", () => {
  it("is the exact ordered 13-element tuple", () => {
    expect(COURSE_DESCRIPTION_SHARD_IDS).toEqual([
      "arts",
      "education",
      "engineering",
      "health-sciences",
      "law",
      "law-civil-law",
      "law-common-law",
      "medicine",
      "science",
      "social-sciences",
      "telfer-school-of-management",
      "vice-rector-academic",
      "other",
    ]);
  });

  it("has exactly 13 elements", () => {
    expect(COURSE_DESCRIPTION_SHARD_IDS).toHaveLength(13);
  });
});

describe("collectLatestCourseDescriptions", () => {
  it("picks the newest non-empty description for MAT 1320 (English)", () => {
    const catalogues: readonly CatalogueJsonInput[] = [
      {
        courses: [
          {
            code: "MAT 1320",
            description: "Older description of MAT 1320.",
          },
        ],
      },
      {
        courses: [
          {
            code: "MAT 1320",
            description: "Newer description of MAT 1320.",
          },
        ],
      },
    ];
    const result = collectLatestCourseDescriptions(catalogues);
    expect(result.get("MAT 1320")).toBe("Newer description of MAT 1320.");
  });

  it("retains older non-empty description for MAT 1720 when newer entry is empty", () => {
    const catalogues: readonly CatalogueJsonInput[] = [
      {
        courses: [
          {
            code: "MAT 1720",
            description: "Calcul différentiel et intégral.",
          },
        ],
      },
      {
        courses: [
          {
            code: "MAT 1720",
            description: "",
          },
        ],
      },
    ];
    const result = collectLatestCourseDescriptions(catalogues);
    expect(result.get("MAT 1720")).toBe("Calcul différentiel et intégral.");
  });

  it("normalizes whitespace runs to a single ASCII space and trims", () => {
    const catalogues: readonly CatalogueJsonInput[] = [
      {
        courses: [
          {
            code: "MAT 1000",
            description: "  Introduction   to   calculus.  ",
          },
        ],
      },
    ];
    const result = collectLatestCourseDescriptions(catalogues);
    expect(result.get("MAT 1000")).toBe("Introduction to calculus.");
  });

  it("preserves punctuation, accents, and catalogue defects unchanged", () => {
    const catalogues: readonly CatalogueJsonInput[] = [
      {
        courses: [
          {
            code: "PHI 1000",
            description: "Logique, éthique & «pensée critique»: un aperçu.",
          },
        ],
      },
    ];
    const result = collectLatestCourseDescriptions(catalogues);
    expect(result.get("PHI 1000")).toBe("Logique, éthique & «pensée critique»: un aperçu.");
  });

  it("normalizes course codes (e.g., 'mat1320' → 'MAT 1320')", () => {
    const catalogues: readonly CatalogueJsonInput[] = [
      {
        courses: [
          {
            code: "mat1320",
            description: "Some description.",
          },
        ],
      },
    ];
    const result = collectLatestCourseDescriptions(catalogues);
    expect(result.has("MAT 1320")).toBe(true);
    expect(result.has("mat1320")).toBe(false);
  });

  it("later catalogue entries with absent description field do not erase earlier values", () => {
    const catalogues: readonly CatalogueJsonInput[] = [
      {
        courses: [{ code: "MAT 2000", description: "A good description." }],
      },
      {
        courses: [{ code: "MAT 2000" }], // no description field at all
      },
    ];
    const result = collectLatestCourseDescriptions(catalogues);
    expect(result.get("MAT 2000")).toBe("A good description.");
  });
});

describe("buildCourseDescriptionShards", () => {
  it("pre-creates all 13 shards even when most are empty", () => {
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["MAT 1320", "Some MAT description."],
    ]);
    const disciplines = makeTestDisciplines();
    const shards = buildCourseDescriptionShards(descriptions, disciplines);

    expect(shards.size).toBe(13);
    for (const id of COURSE_DESCRIPTION_SHARD_IDS) {
      expect(shards.has(id as CourseDescriptionShardId)).toBe(true);
    }
  });

  it("routes MAT → science shard", () => {
    const descriptions: ReadonlyMap<string, string> = new Map([["MAT 1320", "Calculus and more."]]);
    const shards = buildCourseDescriptionShards(descriptions, makeTestDisciplines());

    const science = shards.get("science" as CourseDescriptionShardId);
    expect(science?.courseCodes).toContain("MAT 1320");
    expect(science?.descriptions).toContain("Calculus and more.");
  });

  it("routes unmapped ZZZ discipline to other shard", () => {
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["ZZZ 9999", "An unknown discipline."],
    ]);
    const shards = buildCourseDescriptionShards(descriptions, makeTestDisciplines());

    const other = shards.get("other" as CourseDescriptionShardId);
    expect(other?.courseCodes).toContain("ZZZ 9999");
    expect(other?.descriptions).toContain("An unknown discipline.");
  });

  it("sorts each shard's entries by normalized course code", () => {
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["MAT 2000", "Second."],
      ["MAT 1000", "First."],
      ["MAT 3000", "Third."],
    ]);
    const shards = buildCourseDescriptionShards(descriptions, makeTestDisciplines());
    const science = shards.get("science" as CourseDescriptionShardId)!;

    expect(science.courseCodes).toEqual(["MAT 1000", "MAT 2000", "MAT 3000"]);
    expect(science.descriptions).toEqual(["First.", "Second.", "Third."]);
  });

  it("parallel columns have equal length for every shard", () => {
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["MAT 1320", "Calculus."],
      ["PHI 1000", "Philosophy."],
      ["ZZZ 9999", "Unknown."],
    ]);
    const shards = buildCourseDescriptionShards(descriptions, makeTestDisciplines());

    for (const [, shard] of shards) {
      expect(shard.courseCodes.length).toBe(shard.descriptions.length);
    }
  });

  it("is deterministic: same input produces identical output on repeated calls", () => {
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["MAT 1320", "Calculus."],
      ["MAT 1720", "More calculus."],
      ["PHI 1000", "Logic."],
    ]);
    const disciplines = makeTestDisciplines();

    const first = buildCourseDescriptionShards(descriptions, disciplines);
    const second = buildCourseDescriptionShards(descriptions, disciplines);

    for (const id of COURSE_DESCRIPTION_SHARD_IDS) {
      const a = first.get(id as CourseDescriptionShardId)!;
      const b = second.get(id as CourseDescriptionShardId)!;
      expect(a.courseCodes).toEqual(b.courseCodes);
      expect(a.descriptions).toEqual(b.descriptions);
    }
  });

  it("empty shards have empty parallel arrays (not undefined)", () => {
    const descriptions: ReadonlyMap<string, string> = new Map();
    const shards = buildCourseDescriptionShards(descriptions, makeTestDisciplines());

    for (const [, shard] of shards) {
      expect(Array.isArray(shard.courseCodes)).toBe(true);
      expect(Array.isArray(shard.descriptions)).toBe(true);
    }
  });

  it("produces valid CourseDescriptionShard proto objects (encode/decode round-trip)", () => {
    const descriptions: ReadonlyMap<string, string> = new Map([["MAT 1320", "Calculus."]]);
    const shards = buildCourseDescriptionShards(descriptions, makeTestDisciplines());
    const science = shards.get("science" as CourseDescriptionShardId)!;

    const bytes = DataProto.CourseDescriptionShard.encode(science).finish();
    const decoded = DataProto.CourseDescriptionShard.decode(bytes);
    expect(decoded.courseCodes).toEqual(science.courseCodes);
    expect(decoded.descriptions).toEqual(science.descriptions);
  });
});

// ---------------------------------------------------------------------------
// buildShardIdsFromDisciplines
// ---------------------------------------------------------------------------

function makeCarletonDisciplines(): DataProto.DisciplinesData {
  return {
    faculties: [
      {
        name: "Faculty of Arts and Social Sciences",
        nameFr: "Faculté des arts et des sciences sociales",
      },
      { name: "Faculty of Engineering and Design", nameFr: "Faculté de génie et de conception" },
      { name: "Faculty of Science", nameFr: "Faculté des sciences" },
      { name: "Sprott School of Business", nameFr: "École de commerce Sprott" },
      { name: "Faculty of Public Affairs", nameFr: "Faculté des affaires publiques" },
    ],
    disciplines: [
      { code: "AERO", name: "Aerospace Engineering", nameFr: "Génie aérospatial", facultyRef: 2 },
      { code: "COMP", name: "Computer Science", nameFr: "Informatique", facultyRef: 3 },
      { code: "BUSI", name: "Business", nameFr: "Commerce", facultyRef: 4 },
    ],
  };
}

describe("buildShardIdsFromDisciplines", () => {
  it("derives shard IDs from Carleton faculty names and appends 'other'", () => {
    const shardIds = buildShardIdsFromDisciplines(makeCarletonDisciplines());
    expect(shardIds).toContain("arts-and-social-sciences");
    expect(shardIds).toContain("engineering-and-design");
    expect(shardIds).toContain("science");
    expect(shardIds).toContain("sprott-school-of-business");
    expect(shardIds).toContain("public-affairs");
    expect(shardIds[shardIds.length - 1]).toBe("other");
  });

  it("deduplicates slugs that map to the same ID", () => {
    const disciplines: DataProto.DisciplinesData = {
      faculties: [
        { name: "Faculty of Science", nameFr: "Faculté des sciences" },
        { name: "Faculty of Science", nameFr: "Faculté des sciences" }, // duplicate
      ],
      disciplines: [],
    };
    const shardIds = buildShardIdsFromDisciplines(disciplines);
    const scienceCount = shardIds.filter((id) => id === "science").length;
    expect(scienceCount).toBe(1);
  });

  it("always appends 'other' as the last shard", () => {
    const shardIds = buildShardIdsFromDisciplines(makeCarletonDisciplines());
    expect(shardIds[shardIds.length - 1]).toBe("other");
  });

  it("produces sorted shard IDs (before 'other')", () => {
    const shardIds = buildShardIdsFromDisciplines(makeCarletonDisciplines());
    const withoutOther = shardIds.slice(0, -1);
    expect(withoutOther).toEqual([...withoutOther].sort());
  });
});

describe("buildCourseDescriptionShards with per-school shard IDs", () => {
  it("uses school-derived shard IDs for Carleton and produces correct shard names", () => {
    const disciplines = makeCarletonDisciplines();
    const shardIds = buildShardIdsFromDisciplines(disciplines);
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["AERO 1000", "Intro to Aerospace."],
      ["COMP 2000", "Data structures."],
      ["BUSI 3000", "Business ethics."],
    ]);
    const shards = buildCourseDescriptionShards(descriptions, disciplines, shardIds);

    // Shard map keys should be Carleton faculty slugs, not uOttawa ones.
    const keys = [...shards.keys()];
    expect(keys).toContain("engineering-and-design");
    expect(keys).toContain("science");
    expect(keys).toContain("sprott-school-of-business");
    expect(keys).toContain("other");

    // uOttawa-only shards must NOT appear.
    expect(keys).not.toContain("telfer-school-of-management");
    expect(keys).not.toContain("vice-rector-academic");
    expect(keys).not.toContain("medicine");
    expect(keys).not.toContain("law");
  });

  it("routes AERO → engineering-and-design shard", () => {
    const disciplines = makeCarletonDisciplines();
    const shardIds = buildShardIdsFromDisciplines(disciplines);
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["AERO 1000", "Intro to Aerospace."],
    ]);
    const shards = buildCourseDescriptionShards(descriptions, disciplines, shardIds);
    const engineeringShard = shards.get("engineering-and-design");
    expect(engineeringShard?.courseCodes).toContain("AERO 1000");
  });

  it("uOttawa shards are byte-identical when called with default (COURSE_DESCRIPTION_SHARD_IDS)", () => {
    // Using the uOttawa default should produce the same 13 shards as before.
    const disciplines = makeTestDisciplines(); // MAT→science, PHI→arts
    const descriptions: ReadonlyMap<string, string> = new Map([
      ["MAT 1320", "Calculus."],
      ["PHI 1000", "Logic."],
    ]);
    const defaultShards = buildCourseDescriptionShards(descriptions, disciplines);
    const explicitShards = buildCourseDescriptionShards(
      descriptions,
      disciplines,
      COURSE_DESCRIPTION_SHARD_IDS,
    );

    for (const id of COURSE_DESCRIPTION_SHARD_IDS) {
      expect(defaultShards.get(id)?.courseCodes).toEqual(explicitShards.get(id)?.courseCodes);
      expect(defaultShards.get(id)?.descriptions).toEqual(explicitShards.get(id)?.descriptions);
    }
  });
});
