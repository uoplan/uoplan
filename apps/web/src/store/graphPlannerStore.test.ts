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
