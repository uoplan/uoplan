import { describe, expect, it } from "vitest";
import {
  expandConstrainedPerRequirement,
  buildPendingGroupPickCounts,
} from "../generateSchedulesAction";

describe("expandConstrainedPerRequirement with group tokens", () => {
  it("should not expand group tokens to individual courses", () => {
    const raw = {
      "req-1": ["group:CSI", "CSI 2101"],
      "req-2": ["group:MAT"],
    };

    const { individualSelections, groupTokenSelections } =
      expandConstrainedPerRequirement(raw);

    expect(individualSelections).toEqual({
      "req-1": ["CSI 2101"],
    });

    expect(groupTokenSelections.has("req-1")).toBe(true);
    expect(groupTokenSelections.get("req-1")?.get("group:CSI")).toBe(1);
    expect(groupTokenSelections.has("req-2")).toBe(true);
    expect(groupTokenSelections.get("req-2")?.get("group:MAT")).toBe(1);
  });

  it("should handle multiple selections of the same group token", () => {
    const raw = {
      "req-1": ["group:CSI", "group:CSI", "CSI 2101"],
    };

    const { individualSelections, groupTokenSelections } =
      expandConstrainedPerRequirement(raw);

    expect(individualSelections).toEqual({
      "req-1": ["CSI 2101"],
    });

    expect(groupTokenSelections.has("req-1")).toBe(true);
    expect(groupTokenSelections.get("req-1")?.get("group:CSI")).toBe(2);
  });

  it("aggregates instanced group tokens by canonical prefix", () => {
    const raw = {
      "req-1": ["group:CSI~a", "group:CSI~b", "CSI 2101"],
    };

    const { groupTokenSelections } = expandConstrainedPerRequirement(raw);

    expect(groupTokenSelections.get("req-1")?.get("group:CSI")).toBe(2);
  });
});

describe("buildPendingGroupPickCounts", () => {
  it("aggregates canonical tokens by discipline prefix", () => {
    const sel = new Map<string, Map<string, number>>([
      [
        "req-1",
        new Map<string, number>([
          ["group:CSI", 2],
          ["group:MAT", 1],
        ]),
      ],
    ]);
    const pending = buildPendingGroupPickCounts(sel);
    expect(pending.get("req-1")?.get("CSI")).toBe(2);
    expect(pending.get("req-1")?.get("MAT")).toBe(1);
  });
});