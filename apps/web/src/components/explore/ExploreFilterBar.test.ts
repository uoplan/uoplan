import { describe, expect, it } from "vitest";
import { EXPLORE_FILTER_KEYS } from "../../lib/explore/filterLabels";
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
