import { describe, expect, it } from "vitest";
import { createAppStore } from "../appStore";
import { createTestAppServices } from "../testServices";

describe("applyDesiredAutoAssignments", () => {
  it("writes auto-assigned courses into constrainedPerRequirement and tracks them", () => {
    const store = createAppStore(createTestAppServices());
    store.getState().applyDesiredAutoAssignments({ "req-a": ["CSI 2110"], "req-b": ["MAT 1320"] });
    const s = store.getState();
    expect(s.constrainedPerRequirement).toEqual({ "req-a": ["CSI 2110"], "req-b": ["MAT 1320"] });
    expect(s.autoConstrainedPerRequirement).toEqual({
      "req-a": ["CSI 2110"],
      "req-b": ["MAT 1320"],
    });
  });

  it("removes a previously auto-assigned course when it is no longer assigned", () => {
    const store = createAppStore(createTestAppServices());
    store.getState().applyDesiredAutoAssignments({ "req-a": ["CSI 2110", "CSI 2120"] });
    store.getState().applyDesiredAutoAssignments({ "req-a": ["CSI 2110"] });
    expect(store.getState().constrainedPerRequirement).toEqual({ "req-a": ["CSI 2110"] });
    expect(store.getState().autoConstrainedPerRequirement).toEqual({ "req-a": ["CSI 2110"] });

    store.getState().applyDesiredAutoAssignments({});
    expect(store.getState().constrainedPerRequirement).toEqual({});
    expect(store.getState().autoConstrainedPerRequirement).toEqual({});
  });

  it("preserves manual picks and never clobbers them on removal", () => {
    const store = createAppStore(createTestAppServices());
    // User manually locks a course.
    store.getState().setConstrainedForRequirement("req-a", ["PHI 1101"]);
    // Auto-assignment adds another course to the same requirement.
    store.getState().applyDesiredAutoAssignments({ "req-a": ["CSI 2110"] });
    expect(store.getState().constrainedPerRequirement["req-a"]).toEqual(["PHI 1101", "CSI 2110"]);

    // Removing the desired course must keep the manual pick.
    store.getState().applyDesiredAutoAssignments({});
    expect(store.getState().constrainedPerRequirement["req-a"]).toEqual(["PHI 1101"]);
    expect(store.getState().autoConstrainedPerRequirement).toEqual({});
  });

  it("does not treat an already-manual course as auto (so it survives later removal)", () => {
    const store = createAppStore(createTestAppServices());
    store.getState().setConstrainedForRequirement("req-a", ["CSI 2110"]);
    // The same course is also auto-assigned; it must stay manual, not become auto-tracked.
    store.getState().applyDesiredAutoAssignments({ "req-a": ["CSI 2110"] });
    expect(store.getState().constrainedPerRequirement["req-a"]).toEqual(["CSI 2110"]);
    expect(store.getState().autoConstrainedPerRequirement).toEqual({});

    store.getState().applyDesiredAutoAssignments({});
    expect(store.getState().constrainedPerRequirement["req-a"]).toEqual(["CSI 2110"]);
  });

  it("is idempotent at the fixed point (no state churn)", () => {
    const store = createAppStore(createTestAppServices());
    store.getState().applyDesiredAutoAssignments({ "req-a": ["CSI 2110"] });
    const before = store.getState().constrainedPerRequirement;
    store.getState().applyDesiredAutoAssignments({ "req-a": ["CSI 2110"] });
    // Same object reference is fine; structural equality is what matters.
    expect(store.getState().constrainedPerRequirement).toEqual(before);
    expect(store.getState().autoConstrainedPerRequirement).toEqual({ "req-a": ["CSI 2110"] });
  });
});
