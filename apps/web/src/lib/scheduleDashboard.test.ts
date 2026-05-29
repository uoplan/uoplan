import { beforeAll, describe, expect, it } from "vitest";
import type { RequirementWithStatus } from "@uoplan/core";
import {
  getGenerateBlockers,
  getScheduleDashboardCards,
  type ScheduleDashboardInput,
} from "./scheduleDashboard";
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

    expect(cards.map((card) => [card.id, card.status, card.to, card.gateMessage])).toEqual([
      ["term", "ready", "/schedule", undefined],
      ["program", "ready", "/schedule/program", undefined],
      ["completed", "ready", "/schedule/completed", undefined],
      ["assign", "ready", "/schedule/requirements", undefined],
    ]);
  });

  it("soft-gates dependent cards to the prerequisite route", () => {
    const cards = getScheduleDashboardCards(
      baseState({ selectedTermId: null, firstYear: null, program: null }),
    );

    expect(cards.find((card) => card.id === "term")?.status).toBe("attention");
    expect(cards.find((card) => card.id === "program")).toMatchObject({
      status: "empty",
      gateMessage: "Pick a term first",
      gateTarget: "/schedule",
    });
    expect(cards.find((card) => card.id === "completed")).toMatchObject({
      status: "empty",
      gateMessage: "Pick a program first",
      gateTarget: "/schedule/program",
    });
  });

  it("surfaces options and unassigned-courses attention", () => {
    const cards = getScheduleDashboardCards(
      baseState({
        requirementTreeWithStatus: [optionNode()],
        unassignedCompletedCourses: ["CSI 1100", "MAT 1320"],
      }),
    );

    expect(cards.map((card) => card.id)).toEqual([
      "term",
      "program",
      "completed",
      "options",
      "assign",
    ]);
    expect(cards.find((card) => card.id === "options")?.status).toBe("attention");
    expect(cards.find((card) => card.id === "assign")?.status).toBe("attention");
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

  it("does not block when advanced setup is resolved", () => {
    expect(getGenerateBlockers(baseState())).toEqual([]);
  });
});
