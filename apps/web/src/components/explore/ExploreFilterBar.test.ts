import { describe, expect, it } from "vitest";
import { EXPLORE_FILTER_KEYS, exploreFilterKeysFor } from "../../lib/explore/filterLabels";
import { getSchool } from "@uoplan/domain/school";
import { FILTER_PILL_RADIUS, FILTER_POPOVER_RADIUS } from "./ExploreFilterBar";

describe("ExploreFilterBar helpers", () => {
  it("registers Delivery immediately before Term in the shared filter order", () => {
    expect(EXPLORE_FILTER_KEYS).toEqual([
      "level",
      "language",
      "discipline",
      "difficulty",
      "rating",
      "feedback",
      "delivery",
      "term",
      "sort",
    ]);
  });

  it("uses cozy rounded edges for filter chips and popovers", () => {
    expect(FILTER_PILL_RADIUS).toBe("var(--app-radius-pill)");
    expect(FILTER_POPOVER_RADIUS).toBe("var(--app-radius)");
  });
});

describe("exploreFilterKeysFor", () => {
  it("keeps every pill for a school with grades, feedback, and a bilingual catalogue", () => {
    expect(exploreFilterKeysFor(getSchool("uottawa").features)).toEqual(EXPLORE_FILTER_KEYS);
  });

  it("drops the data-dependent pills for a school without that data", () => {
    const keys = exploreFilterKeysFor(getSchool("carleton").features);
    expect(keys).not.toContain("difficulty");
    expect(keys).not.toContain("feedback");
    expect(keys).not.toContain("language");
    expect(keys).toEqual(["level", "discipline", "rating", "delivery", "term", "sort"]);
  });
});
