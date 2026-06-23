import { describe, expect, it } from "vitest";
import {
  addToCompare,
  clearCompare,
  compareIdsForKind,
  compareRefsFromIds,
  isCompareKind,
  isInCompare,
  MAX_COMPARE_ITEMS,
  removeFromCompare,
  toggleCompare,
} from "./compareSelection";
import type { CompareRef } from "./compareSelection";

const course = (id: string): CompareRef => ({ kind: "course", id });

describe("compareSelection", () => {
  it("adds refs and ignores duplicates", () => {
    let list = addToCompare([], course("CSI2110"));
    list = addToCompare(list, course("CSI2110"));
    list = addToCompare(list, course("MAT1320"));
    expect(list).toEqual([course("CSI2110"), course("MAT1320")]);
  });

  it("caps the selection at MAX_COMPARE_ITEMS", () => {
    let list: CompareRef[] = [];
    for (let i = 0; i < MAX_COMPARE_ITEMS + 3; i++) {
      list = addToCompare(list, course(`C${i}`));
    }
    expect(list).toHaveLength(MAX_COMPARE_ITEMS);
  });

  it("resets to a single ref when a different kind is added", () => {
    const list = addToCompare([course("CSI2110")], { kind: "professor", id: "p1" });
    expect(list).toEqual([{ kind: "professor", id: "p1" }]);
  });

  it("toggles membership", () => {
    let list = toggleCompare([], course("CSI2110"));
    expect(isInCompare(list, course("CSI2110"))).toBe(true);
    list = toggleCompare(list, course("CSI2110"));
    expect(isInCompare(list, course("CSI2110"))).toBe(false);
  });

  it("removes a ref", () => {
    const list = removeFromCompare([course("A"), course("B")], course("A"));
    expect(list).toEqual([course("B")]);
  });

  it("clears", () => {
    expect(clearCompare()).toEqual([]);
  });

  it("encodes/decodes ids for a kind, dedupes, and caps", () => {
    const ids = compareIdsForKind(
      [course("A"), course("B"), { kind: "professor", id: "p" }],
      "course",
    );
    expect(ids).toEqual(["A", "B"]);
    expect(compareRefsFromIds("course", ["A", "A", "", "B"])).toEqual([course("A"), course("B")]);
    expect(compareRefsFromIds("course", ["A", "B", "C", "D", "E"])).toHaveLength(MAX_COMPARE_ITEMS);
  });

  it("validates compare kinds", () => {
    expect(isCompareKind("course")).toBe(true);
    expect(isCompareKind("nope")).toBe(false);
    expect(isCompareKind()).toBe(false);
  });
});
