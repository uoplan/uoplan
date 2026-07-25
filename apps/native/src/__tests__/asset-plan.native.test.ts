import {
  backgroundPrefetchAssetIds,
  isCourseDescriptionAsset,
  planDataAssets,
} from "@/data/asset-plan";

describe("planDataAssets", () => {
  const keys = [
    "uottawa/terms.pb",
    "uottawa/disciplines.pb",
    "uottawa/grades.pb",
    "uottawa/professors.pb",
    "uottawa/ratemyprofessors.pb",
    "uottawa/indices.pb",
    "uottawa/feedback.pb",
    "uottawa/catalogue.pb",
    "uottawa/catalogue.2024.pb",
    "uottawa/catalogue.2026.pb",
    "uottawa/catalogue.2025.pb",
    "uottawa/schedules.2265.pb",
    "uottawa/schedules.2261.pb",
    "uottawa/schedules.2269.pb",
  ];

  it("extracts and sorts schedule term ids", () => {
    const plan = planDataAssets(keys);
    expect(plan.scheduleTermIds).toEqual(["2261", "2265", "2269"]);
  });

  it("extracts and sorts catalogue years and finds the latest", () => {
    const plan = planDataAssets(keys);
    expect(plan.catalogueYears).toEqual([2024, 2025, 2026]);
    expect(plan.latestCatalogueYear).toBe(2026);
  });

  it("ignores the merged catalogue manifest and non-data keys", () => {
    const plan = planDataAssets(["uottawa/catalogue.pb", "uottawa/terms.pb"]);
    expect(plan.catalogueYears).toEqual([]);
    expect(plan.scheduleTermIds).toEqual([]);
    expect(plan.latestCatalogueYear).toBeNull();
  });
});

describe("isCourseDescriptionAsset", () => {
  it("returns true for description shard IDs", () => {
    expect(isCourseDescriptionAsset("catalogue.descriptions.science.pb")).toBe(true);
    expect(isCourseDescriptionAsset("catalogue.descriptions.other.pb")).toBe(true);
    expect(isCourseDescriptionAsset("catalogue.descriptions.arts-humanities.pb")).toBe(true);
  });

  it("returns false when the prefix does not match exactly", () => {
    expect(isCourseDescriptionAsset("xcatalogue.descriptions.science.pb")).toBe(false);
    expect(isCourseDescriptionAsset("catalogue.pb")).toBe(false);
    expect(isCourseDescriptionAsset("catalogue.union.pb")).toBe(false);
    // "descriptions" without "catalogue." prefix
    expect(isCourseDescriptionAsset("descriptions.science.pb")).toBe(false);
  });

  it("returns false when the .pb suffix is missing or wrong", () => {
    expect(isCourseDescriptionAsset("catalogue.descriptions.science")).toBe(false);
    expect(isCourseDescriptionAsset("catalogue.descriptions.science.json")).toBe(false);
    expect(isCourseDescriptionAsset("catalogue.descriptions.science.pb.extra")).toBe(false);
  });
});

describe("backgroundPrefetchAssetIds", () => {
  const manifestIds = [
    "uottawa/catalogue.union.pb",
    "uottawa/catalogue.descriptions.science.pb",
    "uottawa/catalogue.descriptions.other.pb",
    "uottawa/schedules.2265.pb",
    "uottawa/feedback.pb",
    "uottawa/catalogue.2024.pb",
  ];
  const eagerIds = new Set(["uottawa/catalogue.union.pb", "uottawa/schedules.2265.pb"]);

  it("excludes description shard IDs from background prefetch", () => {
    const ids = backgroundPrefetchAssetIds(manifestIds, eagerIds);
    expect(ids).not.toContain("uottawa/catalogue.descriptions.science.pb");
    expect(ids).not.toContain("uottawa/catalogue.descriptions.other.pb");
  });

  it("excludes eager IDs from background prefetch", () => {
    const ids = backgroundPrefetchAssetIds(manifestIds, eagerIds);
    expect(ids).not.toContain("uottawa/catalogue.union.pb");
    expect(ids).not.toContain("uottawa/schedules.2265.pb");
  });

  it("includes non-eager, non-description IDs", () => {
    const ids = backgroundPrefetchAssetIds(manifestIds, eagerIds);
    expect(ids).toContain("uottawa/feedback.pb");
    expect(ids).toContain("uottawa/catalogue.2024.pb");
  });

  it("does not exclude near-matches that are not description assets", () => {
    const nearMatches = [
      "xcatalogue.descriptions.bar.pb", // wrong prefix
      "catalogue.descriptions.science", // missing .pb
    ];
    const ids = backgroundPrefetchAssetIds(nearMatches, new Set());
    expect(ids).toContain("xcatalogue.descriptions.bar.pb");
    expect(ids).toContain("catalogue.descriptions.science");
  });
});
