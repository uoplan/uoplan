import { describe, expect, it } from "vitest";
import {
  buildEffectiveRemainingRequirements,
  buildPendingGroupPickCounts,
  expandConstrainedPerRequirement,
} from "../requirementExpansion";
import type { RemainingRequirement, RequirementWithStatus } from "../index";
import { makeGroupToken, makeGroupTokenInstance } from "../utils/groupToken";

function remaining(id: string): RemainingRequirement {
  return {
    requirementId: id,
    type: "elective",
    title: id,
    candidateCourses: [],
    creditsNeeded: 3,
    satisfiedBy: [],
  };
}

function leaf(id: string, overrides: Partial<RequirementWithStatus> = {}): RequirementWithStatus {
  return {
    requirementId: id,
    type: "elective",
    title: id,
    complete: false,
    candidateCourses: ["AAA 1000"],
    creditsNeeded: 3,
    ...overrides,
  } as RequirementWithStatus;
}

describe("buildEffectiveRemainingRequirements", () => {
  it("returns the base requirements unchanged when the tree adds nothing new", () => {
    const base = [remaining("r1")];
    const tree: RequirementWithStatus[] = [leaf("r1")];
    const out = buildEffectiveRemainingRequirements(base, tree, {});
    expect(out.map((r) => r.requirementId)).toEqual(["r1"]);
  });

  it("includes only the selected branch of an option group", () => {
    const tree: RequirementWithStatus[] = [
      {
        requirementId: "opt",
        type: "or_group",
        title: "Choose one",
        complete: false,
        options: [leaf("branch-a"), leaf("branch-b")],
      } as RequirementWithStatus,
    ];
    const out = buildEffectiveRemainingRequirements([], tree, { opt: 1 });
    expect(out.map((r) => r.requirementId)).toEqual(["branch-b"]);
  });

  it("does not duplicate requirements already present in the base set", () => {
    const base = [remaining("shared")];
    const tree: RequirementWithStatus[] = [leaf("shared"), leaf("extra")];
    const out = buildEffectiveRemainingRequirements(base, tree, {});
    expect(out.map((r) => r.requirementId)).toEqual(["shared", "extra"]);
  });

  it("skips complete nodes and nodes without candidate courses or credits", () => {
    const tree: RequirementWithStatus[] = [
      leaf("done", { complete: true }),
      leaf("no-credits", { creditsNeeded: 0 }),
      leaf("no-candidates", { candidateCourses: [] }),
      leaf("keep"),
    ];
    const out = buildEffectiveRemainingRequirements([], tree, {});
    expect(out.map((r) => r.requirementId)).toEqual(["keep"]);
  });
});

describe("expandConstrainedPerRequirement", () => {
  it("separates individual course picks from group-token picks", () => {
    const raw = {
      r1: ["CSI 2110", makeGroupToken("CSI"), "MAT 1320"],
    };
    const { individualSelections, groupTokenSelections } = expandConstrainedPerRequirement(raw);
    expect(individualSelections.r1.sort()).toEqual(["CSI 2110", "MAT 1320"]);
    expect(groupTokenSelections.get("r1")?.get(makeGroupToken("CSI"))).toBe(1);
  });

  it("counts repeated group-token instances under their canonical token", () => {
    const raw = {
      r1: [
        makeGroupTokenInstance("CSI"),
        makeGroupTokenInstance("CSI"),
        makeGroupTokenInstance("MAT"),
      ],
    };
    const { individualSelections, groupTokenSelections } = expandConstrainedPerRequirement(raw);
    expect(individualSelections.r1).toBeUndefined();
    expect(groupTokenSelections.get("r1")?.get(makeGroupToken("CSI"))).toBe(2);
    expect(groupTokenSelections.get("r1")?.get(makeGroupToken("MAT"))).toBe(1);
  });

  it("dedupes identical individual picks", () => {
    const { individualSelections } = expandConstrainedPerRequirement({
      r1: ["CSI 2110", "CSI 2110"],
    });
    expect(individualSelections.r1).toEqual(["CSI 2110"]);
  });
});

describe("buildPendingGroupPickCounts", () => {
  it("aggregates counts by subject prefix per requirement", () => {
    const { groupTokenSelections } = expandConstrainedPerRequirement({
      r1: [makeGroupTokenInstance("CSI"), makeGroupTokenInstance("CSI"), makeGroupToken("MAT")],
    });
    const out = buildPendingGroupPickCounts(groupTokenSelections);
    expect(out.get("r1")?.get("CSI")).toBe(2);
    expect(out.get("r1")?.get("MAT")).toBe(1);
  });

  it("omits requirements whose tokens all have non-positive counts", () => {
    const input = new Map([["r1", new Map([["group:CSI", 0]])]]);
    expect(buildPendingGroupPickCounts(input).size).toBe(0);
  });
});
