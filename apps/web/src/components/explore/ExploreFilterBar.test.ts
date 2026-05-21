import { describe, expect, it } from "vitest";
import { FILTER_PILL_RADIUS, FILTER_POPOVER_RADIUS, pillHasChevron } from "./ExploreFilterBar";

describe("ExploreFilterBar helpers", () => {
  it("marks the sort pill to show a chevron", () => {
    expect(pillHasChevron("sort")).toBe(true);
    expect(pillHasChevron("level")).toBe(false);
  });

  it("uses squared edges for filter chips and popovers", () => {
    expect(FILTER_PILL_RADIUS).toBe(0);
    expect(FILTER_POPOVER_RADIUS).toBe(0);
  });
});
