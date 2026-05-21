import { describe, expect, it } from "vitest";
import { FILTER_PILL_RADIUS, FILTER_POPOVER_RADIUS } from "./ExploreFilterBar";

describe("ExploreFilterBar helpers", () => {
  it("uses squared edges for filter chips and popovers", () => {
    expect(FILTER_PILL_RADIUS).toBe(0);
    expect(FILTER_POPOVER_RADIUS).toBe(0);
  });
});
