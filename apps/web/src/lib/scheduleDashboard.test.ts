import { beforeAll, describe, expect, it } from "vitest";
import type { RequirementWithStatus } from "@uoplan/core";
import {
  getGenerateBlockers,
  getScheduleDashboardCards,
  resolveInitialOpenStep,
} from "./scheduleDashboard";
import type { ScheduleDashboardInput } from "./scheduleDashboard";
import { dynamicActivate } from "../i18n";

beforeAll(async () => {
  await dynamicActivate("en");
});

function baseState(overrides: Partial<ScheduleDashboardInput> = {}): ScheduleDashboardInput {
  return {
    terms: [{ termId: "2026-01", name: "Winter 2026" }],
    selectedTermId: "2026-01",
    cacheLoaded: true,
    firstYear: 2024,
    program: { title: "Honours Computer Science", url: "cs" },
    completedCourses: [],
    requirementTreeWithStatus: [],
    selectedOptionsPerRequirement: {},
    unassignedCompletedCourses: [],
    ...overrides,
  };
}

function optionNode(): RequirementWithStatus {
  return {
    type: "or_group",
    title: "Choose one science elective",
    complete: false,
    satisfiedBy: [],
    requirementId: "opt-1",
    options: [
      { type: "course", code: "BIO 1101", complete: false, satisfiedBy: [] },
      { type: "course", code: "CHM 1311", complete: false, satisfiedBy: [] },
    ],
  };
}

describe("getScheduleDashboardCards", () => {
  it("always shows assign and marks the shortest complete setup ready", () => {
    const cards = getScheduleDashboardCards(baseState());

    expect(cards.map((card) => [card.id, card.status, card.gateMessage])).toEqual([
      ["term", "ready", undefined],
      ["program", "ready", undefined],
      ["assign", "ready", undefined],
    ]);
  });

  it("summarises the merged program & courses card with completed count", () => {
    const cards = getScheduleDashboardCards(
      baseState({ completedCourses: ["CSI 1100", "MAT 1320"] }),
    );

    const program = cards.find((card) => card.id === "program");
    expect(program?.label).toBe("Program & courses");
    expect(program?.summary).toBe("Honours Computer Science · 2 courses");
  });

  it("falls back to the program title when no completed courses are selected", () => {
    const program = getScheduleDashboardCards(baseState()).find((card) => card.id === "program");
    expect(program?.summary).toBe("Honours Computer Science");
  });

  it("soft-gates dependent cards to the prerequisite step", () => {
    const cards = getScheduleDashboardCards(
      baseState({ selectedTermId: null, firstYear: null, program: null }),
    );

    expect(cards.find((card) => card.id === "term")?.status).toBe("attention");
    expect(cards.find((card) => card.id === "program")).toMatchObject({
      status: "empty",
      gateMessage: "Pick a term first",
    });
    expect(cards.find((card) => card.id === "assign")).toMatchObject({
      status: "empty",
      gateMessage: "Pick a program first",
    });
  });

  it("surfaces options and unassigned-courses attention", () => {
    const cards = getScheduleDashboardCards(
      baseState({
        requirementTreeWithStatus: [optionNode()],
        unassignedCompletedCourses: ["CSI 1100", "MAT 1320"],
      }),
    );

    expect(cards.map((card) => card.id)).toEqual(["term", "program", "options", "assign"]);
    expect(cards.find((card) => card.id === "options")?.status).toBe("attention");
    expect(cards.find((card) => card.id === "assign")?.status).toBe("attention");
  });
});

describe("resolveInitialOpenStep", () => {
  it("opens the first non-gated step needing attention", () => {
    const cards = getScheduleDashboardCards(baseState({ firstYear: null, program: null }));
    // term ready, program needs attention → program opens.
    expect(resolveInitialOpenStep(cards)).toBe("program");
  });

  it("opens the term step when the term is not ready", () => {
    const cards = getScheduleDashboardCards(baseState({ selectedTermId: null }));
    expect(resolveInitialOpenStep(cards)).toBe("term");
  });

  it("opens nothing when every step is ready", () => {
    const cards = getScheduleDashboardCards(baseState());
    expect(resolveInitialOpenStep(cards)).toBeNull();
  });

  it("prefers an explicit ?step deep link over the attention heuristic", () => {
    const cards = getScheduleDashboardCards(baseState());
    expect(resolveInitialOpenStep(cards, "program")).toBe("program");
  });

  it("ignores a ?step that does not match any rendered card", () => {
    const cards = getScheduleDashboardCards(baseState());
    // options card is absent when no option groups exist → fall back to null.
    expect(resolveInitialOpenStep(cards, "options")).toBeNull();
  });
});

describe("getGenerateBlockers", () => {
  it("returns blockers for generation consequences", () => {
    const blockers = getGenerateBlockers(
      baseState({
        program: null,
        requirementTreeWithStatus: [optionNode()],
        unassignedCompletedCourses: ["CSI 1100"],
      }),
    );

    expect(blockers.map((blocker) => blocker.id)).toEqual(["program", "options", "assign"]);
  });

  it("treats an incomplete program selection as a generation blocker", () => {
    expect(
      getGenerateBlockers(baseState({ firstYear: null })).map((blocker) => blocker.id),
    ).toEqual(["program"]);
  });

  it("lists the benefits missed when no program is selected", () => {
    const [program] = getGenerateBlockers(baseState({ program: null }));
    expect(program?.id).toBe("program");
    expect(program?.details).toEqual([
      "Requirement tracking based on your program",
      "Automatic detection of your completed courses",
      "Personalized elective recommendations",
    ]);
  });

  it("does not block when advanced setup is resolved", () => {
    expect(getGenerateBlockers(baseState())).toEqual([]);
  });
});
