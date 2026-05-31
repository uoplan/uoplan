import { describe, expect, it } from "vitest";
import { FILTER_PILL_RADIUS, FILTER_POPOVER_RADIUS } from "./ExploreFilterBar";

describe("ExploreFilterBar helpers", () => {
  it("uses cozy rounded edges for filter chips and popovers", () => {
    expect(FILTER_PILL_RADIUS).toBe("var(--app-radius-pill)");
    expect(FILTER_POPOVER_RADIUS).toBe("var(--app-radius)");
  });
});
