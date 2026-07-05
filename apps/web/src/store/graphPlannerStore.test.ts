import type { TranscriptTerm } from "@uoplan/core/transcript";
import { beforeEach, describe, expect, test } from "vitest";
import { plannerTermCount, useGraphPlannerStore } from "./graphPlannerStore";

const term = (label: string, year: number, courses: string[]): TranscriptTerm => ({
  label,
  year,
  season: "Fall",
  courses,
});

function reset() {
  useGraphPlannerStore.getState().resetPlanner();
}

describe("graphPlannerStore", () => {
  beforeEach(reset);

  test("stores the transcript term breakdown and flags hasTranscript", () => {
    const terms = [term("2022 Fall Term", 2022, ["ADM 1100"])];
    useGraphPlannerStore.getState().setCompletedCourseTerms(terms);
    const s = useGraphPlannerStore.getState();
    expect(s.completedCourseTerms).toEqual(terms);
    expect(s.hasTranscript).toBe(true);

    useGraphPlannerStore.getState().clearTranscript();
    expect(useGraphPlannerStore.getState().hasTranscript).toBe(false);
    expect(useGraphPlannerStore.getState().completedCourseTerms).toEqual([]);
  });

  test("enabling terms keeps them chronological and seeds the default count", () => {
    const store = useGraphPlannerStore.getState();
    store.enableTerm("2271");
    store.enableTerm("2265");
    store.enableTerm("2269");
    const s = useGraphPlannerStore.getState();
    expect(s.enabledTermIds).toEqual(["2265", "2269", "2271"]);
    expect(plannerTermCount(s, "2265")).toBe(s.defaultCount);
  });

  test("enabling a term twice is idempotent", () => {
    const store = useGraphPlannerStore.getState();
    store.enableTerm("2269");
    store.enableTerm("2269");
    expect(useGraphPlannerStore.getState().enabledTermIds).toEqual(["2269"]);
  });

  test("disabling a term drops its count and generation result", () => {
    const store = useGraphPlannerStore.getState();
    store.enableTerm("2269");
    store.setGeneratedTerm({
      termId: "2269",
      courses: ["CSI 2101"],
      requestedCount: 5,
      status: "ok",
      generatedAt: 1,
    });
    store.disableTerm("2269");
    const s = useGraphPlannerStore.getState();
    expect(s.enabledTermIds).toEqual([]);
    expect(s.countByTermId["2269"]).toBeUndefined();
    expect(s.generatedByTermId["2269"]).toBeUndefined();
  });

  test("per-term count clamps to the valid range", () => {
    const store = useGraphPlannerStore.getState();
    store.enableTerm("2269");
    store.setCountForTerm("2269", 99);
    expect(plannerTermCount(useGraphPlannerStore.getState(), "2269")).toBe(12);
    store.setCountForTerm("2269", 0);
    expect(plannerTermCount(useGraphPlannerStore.getState(), "2269")).toBe(1);
    store.setCountForTerm("2269", 3.7);
    expect(plannerTermCount(useGraphPlannerStore.getState(), "2269")).toBe(4);
  });

  test("clearGeneratedFrom invalidates the term and every later term", () => {
    const store = useGraphPlannerStore.getState();
    for (const id of ["2265", "2269", "2271"]) {
      store.enableTerm(id);
      store.setGeneratedTerm({
        termId: id,
        courses: [`C ${id}`],
        requestedCount: 5,
        status: "ok",
        generatedAt: 1,
      });
    }
    store.clearGeneratedFrom("2269");
    const s = useGraphPlannerStore.getState();
    expect(Object.keys(s.generatedByTermId).sort()).toEqual(["2265"]);
  });

  test("setTermResult retains a bundle that disableTerm and clearGeneratedFrom drop", () => {
    const bundle = (code: string) =>
      ({
        currentSchedule: { enrollments: [{ courseCode: code }] },
        swapPool: [],
        chosenCourseToRequirementId: {},
        currentPoolMap: {},
        currentColorMap: {},
        generationError: null,
      }) as never;
    const store = useGraphPlannerStore.getState();
    for (const id of ["2265", "2269", "2271"]) {
      store.enableTerm(id);
      store.setTermResult(id, bundle(`C ${id}`));
    }
    expect(Object.keys(useGraphPlannerStore.getState().resultByTermId).sort()).toEqual([
      "2265",
      "2269",
      "2271",
    ]);

    store.clearGeneratedFrom("2269");
    expect(Object.keys(useGraphPlannerStore.getState().resultByTermId).sort()).toEqual(["2265"]);

    store.disableTerm("2265");
    expect(useGraphPlannerStore.getState().resultByTermId["2265"]).toBeUndefined();
  });

  test("setTermSeed persists per-term seeds that disableTerm and clearPlannedTerms drop", () => {
    const store = useGraphPlannerStore.getState();
    store.enableTerm("2265");
    store.enableTerm("2269");
    store.setTermSeed("2265", 101);
    store.setTermSeed("2269", 102);
    expect(useGraphPlannerStore.getState().seedByTermId).toEqual({ "2265": 101, "2269": 102 });

    store.disableTerm("2265");
    expect(useGraphPlannerStore.getState().seedByTermId).toEqual({ "2269": 102 });

    store.clearPlannedTerms();
    expect(useGraphPlannerStore.getState().seedByTermId).toEqual({});
  });

  test("panel position and collapsed state persist; resetLayout re-anchors the panel", () => {
    const store = useGraphPlannerStore.getState();
    store.setPanelPosition({ x: 200, y: 120 });
    store.setPanelSize({ width: 400, height: 500 });
    store.setPanelCollapsed(true);
    let s = useGraphPlannerStore.getState();
    expect(s.panelPosition).toEqual({ x: 200, y: 120 });
    expect(s.panelSize).toEqual({ width: 400, height: 500 });
    expect(s.panelCollapsed).toBe(true);

    store.resetLayout();
    s = useGraphPlannerStore.getState();
    expect(s.panelPosition).toBeNull();
    expect(s.panelSize).toBeNull();
    // Collapsing is a separate preference; resetLayout only re-anchors position.
    expect(s.panelCollapsed).toBe(true);
  });

  test("beginCalendarLink snapshots the real context and endCalendarLink clears it", () => {
    const store = useGraphPlannerStore.getState();
    const snapshot = {
      completedCourses: ["MAT 1341"],
      selectedTermId: "2265",
      schedulesData: null,
      cache: null,
      coursesThisSemester: 4,
      remainingRequirements: [],
      requirementTreeWithStatus: [],
      completedRequirementsList: [],
      selectedPerRequirement: {},
      selectedOptionsPerRequirement: {},
      prereqEligibleCourses: [],
      filteredPrereqEligibleCourses: [],
      unassignedCompletedCourses: [],
    };
    store.beginCalendarLink("2269", snapshot);
    let s = useGraphPlannerStore.getState();
    expect(s.linkedCalendarTermId).toBe("2269");
    expect(s.preLinkCompletedContext).toEqual(snapshot);

    store.endCalendarLink();
    s = useGraphPlannerStore.getState();
    expect(s.linkedCalendarTermId).toBeNull();
    expect(s.preLinkCompletedContext).toBeNull();
  });

  test("enabling a term focuses it; disabling or clearing resets the focus", () => {
    const store = useGraphPlannerStore.getState();
    store.enableTerm("2265");
    expect(useGraphPlannerStore.getState().selectedTermId).toBe("2265");

    // Enabling a later term moves focus to it.
    store.enableTerm("2269");
    expect(useGraphPlannerStore.getState().selectedTermId).toBe("2269");

    // Explicit selection wins, including back to the Overview tab (null).
    store.setSelectedTermId("2265");
    expect(useGraphPlannerStore.getState().selectedTermId).toBe("2265");
    store.setSelectedTermId(null);
    expect(useGraphPlannerStore.getState().selectedTermId).toBeNull();

    // Disabling the focused term clears the focus; disabling another keeps it.
    store.setSelectedTermId("2269");
    store.disableTerm("2265");
    expect(useGraphPlannerStore.getState().selectedTermId).toBe("2269");
    store.disableTerm("2269");
    expect(useGraphPlannerStore.getState().selectedTermId).toBeNull();

    // Clearing the whole plan resets focus to Overview.
    store.enableTerm("2271");
    store.clearPlannedTerms();
    expect(useGraphPlannerStore.getState().selectedTermId).toBeNull();
  });

  test("resetPlanner returns to the empty initial state", () => {
    const store = useGraphPlannerStore.getState();
    store.setCompletedCourseTerms([term("2022 Fall Term", 2022, ["ADM 1100"])]);
    store.enableTerm("2269");
    store.resetPlanner();
    const s = useGraphPlannerStore.getState();
    expect(s.completedCourseTerms).toEqual([]);
    expect(s.hasTranscript).toBe(false);
    expect(s.enabledTermIds).toEqual([]);
    expect(s.generatedByTermId).toEqual({});
  });
});
