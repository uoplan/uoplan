import { describe, expect, it } from "vitest";

import { createAppStore } from "../appStore";
import { createTestAppServices } from "../testServices";

describe("compare slice", () => {
  it("starts empty", () => {
    const store = createAppStore(createTestAppServices());
    expect(store.getState().compareRefs).toEqual([]);
  });

  it("adds, toggles, and clears course refs", () => {
    const store = createAppStore(createTestAppServices());
    const { addToCompare, toggleCompare, clearCompare } = store.getState();

    addToCompare({ kind: "course", id: "CSI2110" });
    addToCompare({ kind: "course", id: "MAT1320" });
    expect(store.getState().compareRefs).toEqual([
      { kind: "course", id: "CSI2110" },
      { kind: "course", id: "MAT1320" },
    ]);

    // toggle removes an existing ref
    toggleCompare({ kind: "course", id: "CSI2110" });
    expect(store.getState().compareRefs).toEqual([{ kind: "course", id: "MAT1320" }]);

    clearCompare();
    expect(store.getState().compareRefs).toEqual([]);
  });

  it("caps the tray at the shared maximum and dedupes", () => {
    const store = createAppStore(createTestAppServices());
    const { addToCompare } = store.getState();

    for (const id of ["A1000", "B1000", "C1000", "D1000", "E1000"]) {
      addToCompare({ kind: "course", id });
    }
    // capped at MAX_COMPARE_ITEMS (4)
    expect(store.getState().compareRefs).toHaveLength(4);

    addToCompare({ kind: "course", id: "A1000" });
    expect(store.getState().compareRefs.filter((r) => r.id === "A1000")).toHaveLength(1);
  });

  it("resets to the new kind when a different resource kind is added", () => {
    const store = createAppStore(createTestAppServices());
    const { addToCompare } = store.getState();

    addToCompare({ kind: "course", id: "CSI2110" });
    addToCompare({ kind: "professor", id: "smith" });
    expect(store.getState().compareRefs).toEqual([{ kind: "professor", id: "smith" }]);
  });
});
