import { planDataAssets } from "@/data/asset-plan";

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
