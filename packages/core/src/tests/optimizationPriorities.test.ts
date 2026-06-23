import { describe, expect, it } from "vitest";

import {
  DEFAULT_GOOD_BREAKS_COUNT,
  DEFAULT_GOOD_BREAKS_TARGET_MINUTES,
  DEFAULT_OPTIMIZATION_PRIORITIES,
  defaultOptimizationPriorities,
  getOptimizationPriority,
  isOptimizationEnabled,
  isOptimizationKind,
  MAX_GOOD_BREAKS_COUNT,
  MAX_GOOD_BREAKS_TARGET_MINUTES,
  MIN_GOOD_BREAKS_COUNT,
  MIN_GOOD_BREAKS_TARGET_MINUTES,
  normalizeOptimizationPriorities,
  OPTIMIZATION_KINDS,
  reorderOptimizationPriorities,
  setGoodBreaksParams,
  setOptimizationPriorityEnabled,
  toggleOptimizationPriority,
} from "../optimizationPriorities";

describe("optimizationPriorities", () => {
  it("default list covers every kind exactly once, in order", () => {
    const list = defaultOptimizationPriorities();
    expect(list.map((p) => p.kind)).toEqual([...OPTIMIZATION_KINDS]);
    expect(new Set(list.map((p) => p.kind)).size).toBe(OPTIMIZATION_KINDS.length);
  });

  it("default list preserves prior web defaults (prefer_* on, shape objectives off)", () => {
    expect(isOptimizationEnabled(DEFAULT_OPTIMIZATION_PRIORITIES, "prefer_easier")).toBe(true);
    expect(isOptimizationEnabled(DEFAULT_OPTIMIZATION_PRIORITIES, "prefer_sentiment")).toBe(true);
    expect(isOptimizationEnabled(DEFAULT_OPTIMIZATION_PRIORITIES, "prefer_professor_rating")).toBe(
      true,
    );
    expect(isOptimizationEnabled(DEFAULT_OPTIMIZATION_PRIORITIES, "free_days")).toBe(false);
    expect(isOptimizationEnabled(DEFAULT_OPTIMIZATION_PRIORITIES, "good_breaks")).toBe(false);
  });

  it("good_breaks carries default break params", () => {
    const gb = getOptimizationPriority(DEFAULT_OPTIMIZATION_PRIORITIES, "good_breaks");
    expect(gb?.breakCount).toBe(DEFAULT_GOOD_BREAKS_COUNT);
    expect(gb?.breakTargetMinutes).toBe(DEFAULT_GOOD_BREAKS_TARGET_MINUTES);
  });

  it("defaultOptimizationPriorities returns a fresh clone", () => {
    const a = defaultOptimizationPriorities();
    a[0]!.enabled = true;
    expect(DEFAULT_OPTIMIZATION_PRIORITIES[0]!.enabled).toBe(false);
  });

  it("isOptimizationKind guards unknown values", () => {
    expect(isOptimizationKind("free_days")).toBe(true);
    expect(isOptimizationKind("nope")).toBe(false);
    expect(isOptimizationKind()).toBe(false);
  });

  it("toggle and setEnabled produce new immutable lists", () => {
    const base = defaultOptimizationPriorities();
    const toggled = toggleOptimizationPriority(base, "free_days");
    expect(isOptimizationEnabled(toggled, "free_days")).toBe(true);
    expect(isOptimizationEnabled(base, "free_days")).toBe(false);
    const off = setOptimizationPriorityEnabled(toggled, "free_days", false);
    expect(isOptimizationEnabled(off, "free_days")).toBe(false);
  });

  it("reorder moves an item without losing entries", () => {
    const base = defaultOptimizationPriorities();
    const moved = reorderOptimizationPriorities(base, 0, 2);
    expect(moved.map((p) => p.kind)).toEqual([
      "good_breaks",
      "prefer_easier",
      "free_days",
      "prefer_sentiment",
      "prefer_professor_rating",
    ]);
    expect(moved).toHaveLength(base.length);
  });

  it("reorder ignores out-of-range / no-op indices", () => {
    const base = defaultOptimizationPriorities();
    expect(reorderOptimizationPriorities(base, 0, 0).map((p) => p.kind)).toEqual(
      base.map((p) => p.kind),
    );
    expect(reorderOptimizationPriorities(base, -1, 2).map((p) => p.kind)).toEqual(
      base.map((p) => p.kind),
    );
    expect(reorderOptimizationPriorities(base, 0, 99).map((p) => p.kind)).toEqual(
      base.map((p) => p.kind),
    );
  });

  it("setGoodBreaksParams clamps to allowed bounds", () => {
    const base = defaultOptimizationPriorities();
    const tooHigh = setGoodBreaksParams(base, { breakCount: 99, breakTargetMinutes: 9999 });
    const gbHigh = getOptimizationPriority(tooHigh, "good_breaks");
    expect(gbHigh?.breakCount).toBe(MAX_GOOD_BREAKS_COUNT);
    expect(gbHigh?.breakTargetMinutes).toBe(MAX_GOOD_BREAKS_TARGET_MINUTES);

    const tooLow = setGoodBreaksParams(base, { breakCount: -5, breakTargetMinutes: 1 });
    const gbLow = getOptimizationPriority(tooLow, "good_breaks");
    expect(gbLow?.breakCount).toBe(MIN_GOOD_BREAKS_COUNT);
    expect(gbLow?.breakTargetMinutes).toBe(MIN_GOOD_BREAKS_TARGET_MINUTES);
  });

  it("normalize fills missing kinds and drops unknown/duplicate ones", () => {
    const result = normalizeOptimizationPriorities([
      { kind: "free_days", enabled: true },
      { kind: "bogus", enabled: true },
      { kind: "free_days", enabled: false },
    ]);
    expect(result.map((p) => p.kind)).toEqual([
      "free_days",
      "good_breaks",
      "prefer_easier",
      "prefer_sentiment",
      "prefer_professor_rating",
    ]);
    expect(isOptimizationEnabled(result, "free_days")).toBe(true);
  });

  it("normalize coerces bad break params for good_breaks", () => {
    const result = normalizeOptimizationPriorities([
      { kind: "good_breaks", enabled: true, breakCount: 999, breakTargetMinutes: -5 },
    ]);
    const gb = getOptimizationPriority(result, "good_breaks");
    expect(gb?.breakCount).toBe(MAX_GOOD_BREAKS_COUNT);
    expect(gb?.breakTargetMinutes).toBe(MIN_GOOD_BREAKS_TARGET_MINUTES);
  });

  it("normalize returns a full default list for non-array input", () => {
    expect(normalizeOptimizationPriorities(null).map((p) => p.kind)).toEqual([
      ...OPTIMIZATION_KINDS,
    ]);
    expect(normalizeOptimizationPriorities().map((p) => p.kind)).toEqual([...OPTIMIZATION_KINDS]);
  });
});
