import { describe, expect, it } from "vitest";
import { collectRequirementIds, gateRemainingByPriority } from "../requirements/priority";
import type { RemainingRequirement, RequirementWithStatus } from "../requirements/types";

function remaining(requirementId: string): RemainingRequirement {
  return {
    requirementId,
    type: "credits",
    candidateCourses: [],
    satisfiedBy: [],
  };
}

describe("collectRequirementIds", () => {
  it("collects the node id and all descendant option ids", () => {
    const node: RequirementWithStatus = {
      type: "group",
      requirementId: "root",
      complete: false,
      satisfiedBy: [],
      options: [
        { type: "credits", requirementId: "a", complete: false, satisfiedBy: [] },
        {
          type: "group",
          requirementId: "b",
          complete: false,
          satisfiedBy: [],
          options: [{ type: "credits", requirementId: "c", complete: false, satisfiedBy: [] }],
        },
      ],
    };
    expect(collectRequirementIds(node)).toEqual(["root", "a", "b", "c"]);
  });

  it("skips nodes without a requirementId", () => {
    const node: RequirementWithStatus = {
      type: "group",
      complete: false,
      satisfiedBy: [],
      options: [{ type: "credits", requirementId: "only", complete: false, satisfiedBy: [] }],
    };
    expect(collectRequirementIds(node)).toEqual(["only"]);
  });
});

describe("gateRemainingByPriority", () => {
  it("is a no-op when no priorities are set", () => {
    const input = [remaining("a"), remaining("b")];
    const out = gateRemainingByPriority(input, {});
    expect(out).toBe(input);
  });

  it("is a no-op when all priorities are zero", () => {
    const input = [remaining("a"), remaining("b")];
    const out = gateRemainingByPriority(input, { a: 0, b: 0 });
    expect(out).toBe(input);
  });

  it("keeps only the lowest tier present", () => {
    const input = [remaining("a"), remaining("b"), remaining("c")];
    const out = gateRemainingByPriority(input, { b: 1, c: 2 });
    // a defaults to 0 (lowest tier) — only it is offered.
    expect(out.map((r) => r.requirementId)).toEqual(["a"]);
  });

  it("advances to the next tier once the lower tier is gone", () => {
    const input = [remaining("b"), remaining("c")];
    const out = gateRemainingByPriority(input, { b: 1, c: 2 });
    expect(out.map((r) => r.requirementId)).toEqual(["b"]);
  });

  it("keeps all members of the lowest tier", () => {
    const input = [remaining("a"), remaining("b"), remaining("c")];
    const out = gateRemainingByPriority(input, { a: 1, b: 1, c: 2 });
    expect(out.map((r) => r.requirementId)).toEqual(["a", "b"]);
  });

  it("returns the input unchanged for an empty list", () => {
    const input: RemainingRequirement[] = [];
    expect(gateRemainingByPriority(input, { a: 1 })).toBe(input);
  });
});
