import { describe, it, expect } from "vitest";
import { collectRequirementIds, gateRemainingByPriority } from "@uoplan/core";
import type { RemainingRequirement, RequirementWithStatus } from "@uoplan/core";
import { priorityForIds, stampPriorityForIds } from "./RequirementPriorityControl";

function remaining(requirementId: string): RemainingRequirement {
  return { requirementId, type: "credits", candidateCourses: [], satisfiedBy: [] };
}

const tree: RequirementWithStatus = {
  type: "group",
  requirementId: "root",
  complete: false,
  satisfiedBy: [],
  options: [
    { type: "credits", requirementId: "base-a", complete: false, satisfiedBy: [] },
    {
      type: "group",
      requirementId: "law",
      complete: false,
      satisfiedBy: [],
      options: [{ type: "credits", requirementId: "law-1", complete: false, satisfiedBy: [] }],
    },
  ],
};

describe("RequirementPriorityControl logic", () => {
  it("priorityForIds reads the max priority across the subtree (default 0)", () => {
    const ids = collectRequirementIds(tree);
    expect(priorityForIds(ids, {})).toBe(0);
    expect(priorityForIds(ids, { law: 3 })).toBe(3);
    expect(priorityForIds(ids, { "base-a": 1, "law-1": 5 })).toBe(5);
  });

  it("stampPriorityForIds stamps every descendant id to the chosen value", () => {
    const ids = collectRequirementIds(tree);
    expect(stampPriorityForIds(ids, 2)).toEqual({
      root: 2,
      "base-a": 2,
      law: 2,
      "law-1": 2,
    });
  });

  it("stamping 0 resets the subtree to normal", () => {
    const ids = collectRequirementIds(tree);
    expect(stampPriorityForIds(ids, 0)).toEqual({
      root: 0,
      "base-a": 0,
      law: 0,
      "law-1": 0,
    });
  });

  it("setting a higher priority on one subtree defers it behind the rest in generation", () => {
    // Simulate the user bumping the "law" subtree to priority 1.
    const lawIds = collectRequirementIds(tree.options![1]);
    const priorities = stampPriorityForIds(lawIds, 1);

    // base-a stays at the default 0 tier; law/law-1 are at tier 1.
    const input = [remaining("base-a"), remaining("law"), remaining("law-1")];
    const firstPass = gateRemainingByPriority(input, priorities);
    expect(firstPass.map((r) => r.requirementId)).toEqual(["base-a"]);

    // Once the base tier is satisfied (gone), the deferred law tier is offered.
    const secondPass = gateRemainingByPriority([remaining("law"), remaining("law-1")], priorities);
    expect(secondPass.map((r) => r.requirementId)).toEqual(["law", "law-1"]);
  });

  it("round-trips through the control read/write helpers", () => {
    const ids = collectRequirementIds(tree);
    const patch = stampPriorityForIds(ids, 4);
    expect(priorityForIds(ids, patch)).toBe(4);
  });
});
