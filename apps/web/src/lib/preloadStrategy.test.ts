import { describe, it, expect } from "vitest";
import { shouldEnablePreload } from "./preloadStrategy";

describe("shouldEnablePreload", () => {
  it("enables intent preloading on a normal connection", () => {
    expect(shouldEnablePreload({ saveData: false, effectiveType: "4g" })).toBe("intent");
  });

  it("disables preloading when Save-Data is enabled", () => {
    expect(shouldEnablePreload({ saveData: true, effectiveType: "4g" })).toBe(false);
  });

  it("disables preloading on slow-2g and 2g connections", () => {
    expect(shouldEnablePreload({ effectiveType: "slow-2g" })).toBe(false);
    expect(shouldEnablePreload({ effectiveType: "2g" })).toBe(false);
  });

  it("enables preloading on 3g connections", () => {
    expect(shouldEnablePreload({ effectiveType: "3g" })).toBe("intent");
  });

  it("enables preloading when the Network Information API is unavailable", () => {
    expect(shouldEnablePreload(undefined)).toBe("intent");
  });
});
