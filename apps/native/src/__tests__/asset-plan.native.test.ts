import {
  backgroundPrefetchAssetIds,
  isCourseDescriptionAsset,
  planDataAssets,
} from "@/data/asset-plan";

describe("planDataAssets", () => {
  const keys = [
    "terms.pb",
    "disciplines.pb",
    "grades.pb",
    "professors.pb",
    "ratemyprofessors.pb",
    "indices.pb",
    "feedback.pb",
    "catalogue.pb",
    "catalogue.2024.pb",
    "catalogue.2026.pb",
    "catalogue.2025.pb",
    "schedules.2265.pb",
    "schedules.2261.pb",
    "schedules.2269.pb",
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
    const plan = planDataAssets(["catalogue.pb", "terms.pb"]);
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
    "catalogue.union.pb",
    "catalogue.descriptions.science.pb",
    "catalogue.descriptions.other.pb",
    "schedules.2265.pb",
    "feedback.pb",
    "catalogue.2024.pb",
  ];
  const eagerIds = new Set(["catalogue.union.pb", "schedules.2265.pb"]);

  it("excludes description shard IDs from background prefetch", () => {
    const ids = backgroundPrefetchAssetIds(manifestIds, eagerIds);
    expect(ids).not.toContain("catalogue.descriptions.science.pb");
    expect(ids).not.toContain("catalogue.descriptions.other.pb");
  });

  it("excludes eager IDs from background prefetch", () => {
    const ids = backgroundPrefetchAssetIds(manifestIds, eagerIds);
    expect(ids).not.toContain("catalogue.union.pb");
    expect(ids).not.toContain("schedules.2265.pb");
  });

  it("includes non-eager, non-description IDs", () => {
    const ids = backgroundPrefetchAssetIds(manifestIds, eagerIds);
    expect(ids).toContain("feedback.pb");
    expect(ids).toContain("catalogue.2024.pb");
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
