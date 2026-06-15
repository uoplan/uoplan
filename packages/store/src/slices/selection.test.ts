import { describe, expect, it } from "vitest";

import { createAppStore } from "../appStore";
import { createTestAppServices } from "../testServices";

describe("selection slice completed courses", () => {
  it("auto-enables the French immersion stream when an FLS course is completed", () => {
    const store = createAppStore(createTestAppServices());
    store.setState({
      calendarMode: "basic",
      frenchImmersionStream: false,
      languageBuckets: ["en"],
      generationOptionsDirty: false,
    });

    store.getState().setCompletedCourses(["CSI 2101"]);

    expect(store.getState().frenchImmersionStream).toBe(false);

    store.getState().setCompletedCourses(["CSI 2101", "FLS 1500"]);

    expect(store.getState().frenchImmersionStream).toBe(true);
    expect(store.getState().languageBuckets).toContain("fr");
  });

  it("does not auto-disable the French immersion stream when FLS courses are removed", () => {
    const store = createAppStore(createTestAppServices());
    store.setState({
      calendarMode: "basic",
      frenchImmersionStream: false,
      languageBuckets: ["en"],
      generationOptionsDirty: false,
    });

    store.getState().setCompletedCourses(["FLS 1500"]);
    store.getState().setCompletedCourses([]);

    expect(store.getState().frenchImmersionStream).toBe(true);
    expect(store.getState().languageBuckets).toContain("fr");
  });
});
