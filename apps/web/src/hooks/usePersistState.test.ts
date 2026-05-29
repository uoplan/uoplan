import { describe, expect, it } from "vitest";
import { defaultAppStore } from "../store/appStore";
import { hasPersistedStateChange } from "./usePersistState";

describe("hasPersistedStateChange", () => {
  it("ignores schedule display-only updates", () => {
    const prev = defaultAppStore.getState();
    const next = {
      ...prev,
      scheduleGenerating: true,
      currentColorMap: { CSI3105: 2 },
    };

    expect(hasPersistedStateChange(next, prev)).toBe(false);
  });

  it("detects updates that are encoded into persisted state", () => {
    const prev = defaultAppStore.getState();
    const next = {
      ...prev,
      completedCourses: [...prev.completedCourses, "CSI 3105"],
    };

    expect(hasPersistedStateChange(next, prev)).toBe(true);
  });
});
