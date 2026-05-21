import { describe, expect, it } from "vitest";
import {
  buildVisibleStepIndices,
  canAdvanceWizardStep,
  firstInteractiveStepAfter,
  furthestReachedDisplayIndex,
  getNextStep,
  getPrevStep,
  isWizardStepSkipped,
  maxReachableWizardStep,
  normalizeActiveStep,
  skippedWizardStepIsPassed,
  WizardStep,
  type WizardProceedContext,
} from "./wizardSteps";

describe("buildVisibleStepIndices", () => {
  it("includes options and assign when both needed", () => {
    expect(buildVisibleStepIndices(true, true)).toEqual([
      WizardStep.Term,
      WizardStep.Program,
      WizardStep.Completed,
      WizardStep.Options,
      WizardStep.Assign,
    ]);
  });

  it("skips options and assign when neither needed", () => {
    expect(buildVisibleStepIndices(false, false)).toEqual([
      WizardStep.Term,
      WizardStep.Program,
      WizardStep.Completed,
    ]);
  });

  it("includes only options when assign not needed", () => {
    expect(buildVisibleStepIndices(true, false)).toEqual([
      WizardStep.Term,
      WizardStep.Program,
      WizardStep.Completed,
      WizardStep.Options,
    ]);
  });

  it("includes only assign when options not needed", () => {
    expect(buildVisibleStepIndices(false, true)).toEqual([
      WizardStep.Term,
      WizardStep.Program,
      WizardStep.Completed,
      WizardStep.Assign,
    ]);
  });
});

describe("getNextStep / getPrevStep", () => {
  it("stays on completed when options and assign skipped", () => {
    expect(getNextStep(WizardStep.Completed, false, false)).toBe(WizardStep.Completed);
    expect(getPrevStep(WizardStep.Completed, false, false)).toBe(WizardStep.Program);
  });

  it("goes through assign when only options skipped", () => {
    expect(getNextStep(WizardStep.Completed, false, true)).toBe(WizardStep.Assign);
    expect(getPrevStep(WizardStep.Assign, false, true)).toBe(WizardStep.Completed);
  });

  it("stays on last step", () => {
    expect(getNextStep(WizardStep.Assign, true, true)).toBe(WizardStep.Assign);
  });
});

describe("normalizeActiveStep", () => {
  it("maps skipped options step to assign or completed", () => {
    expect(normalizeActiveStep(WizardStep.Options, false, false)).toBe(WizardStep.Completed);
    expect(normalizeActiveStep(WizardStep.Options, false, true)).toBe(WizardStep.Assign);
  });

  it("maps skipped assign step to completed", () => {
    expect(normalizeActiveStep(WizardStep.Assign, false, false)).toBe(WizardStep.Completed);
  });

  it("leaves valid steps unchanged", () => {
    expect(normalizeActiveStep(WizardStep.Completed, false, false)).toBe(WizardStep.Completed);
  });
});

describe("furthestReachedDisplayIndex", () => {
  const skipBoth = [WizardStep.Term, WizardStep.Program, WizardStep.Completed];

  it("uses the visible index when furthest actual is on the list", () => {
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Completed)).toBe(2);
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Program)).toBe(1);
  });

  it("maps past a dropped optional step to the next visible row", () => {
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Assign)).toBe(2);
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Options)).toBe(2);
  });
});

describe("skipped optional steps", () => {
  it("detects skipped options and assign rows", () => {
    expect(isWizardStepSkipped(WizardStep.Options, false, false)).toBe(true);
    expect(isWizardStepSkipped(WizardStep.Assign, false, false)).toBe(true);
    expect(isWizardStepSkipped(WizardStep.Options, true, false)).toBe(false);
    expect(isWizardStepSkipped(WizardStep.Assign, false, true)).toBe(false);
  });

  it("firstInteractiveStepAfter finds the next interactive step", () => {
    expect(firstInteractiveStepAfter(WizardStep.Completed, false, false)).toBe(undefined);
    expect(firstInteractiveStepAfter(WizardStep.Completed, true, false)).toBe(WizardStep.Options);
    expect(firstInteractiveStepAfter(WizardStep.Options, false, true)).toBe(WizardStep.Assign);
  });

  it("skippedWizardStepIsPassed when furthest reaches the next step", () => {
    expect(skippedWizardStepIsPassed(WizardStep.Options, WizardStep.Assign, true, false)).toBe(
      false,
    );
    expect(skippedWizardStepIsPassed(WizardStep.Options, WizardStep.Completed, false, false)).toBe(
      false,
    );
    expect(skippedWizardStepIsPassed(WizardStep.Assign, WizardStep.Completed, false, false)).toBe(
      false,
    );
  });
});

function baseProceedCtx(over: Partial<WizardProceedContext> = {}): WizardProceedContext {
  return {
    hasTerms: true,
    selectedTermId: "t1",
    cacheLoaded: true,
    firstYear: 2024,
    hasProgram: true,
    missingOptions: false,
    needsOptionsStep: false,
    unassignedCount: 0,
    ...over,
  };
}

describe("maxReachableWizardStep", () => {
  it("stays on term when term incomplete", () => {
    expect(maxReachableWizardStep(false, false, baseProceedCtx({ hasTerms: false }))).toBe(
      WizardStep.Term,
    );
  });

  it("allows proceeding past program when term is complete", () => {
    expect(maxReachableWizardStep(false, false, baseProceedCtx())).toBe(WizardStep.Completed);
  });

  it("stops at term when term incomplete", () => {
    expect(
      maxReachableWizardStep(
        false,
        false,
        baseProceedCtx({ hasTerms: false, selectedTermId: null, cacheLoaded: false }),
      ),
    ).toBe(WizardStep.Term);
  });

  it("stops at program when programme missing", () => {
    expect(maxReachableWizardStep(false, false, baseProceedCtx({ hasProgram: false }))).toBe(
      WizardStep.Program,
    );
  });

  it("reaches completed on shortest path", () => {
    expect(maxReachableWizardStep(false, false, baseProceedCtx())).toBe(WizardStep.Completed);
  });

  it("stops at options when selections missing", () => {
    expect(
      maxReachableWizardStep(
        true,
        false,
        baseProceedCtx({ needsOptionsStep: true, missingOptions: true }),
      ),
    ).toBe(WizardStep.Options);
  });

  it("stops at assign when unassigned courses", () => {
    expect(maxReachableWizardStep(false, true, baseProceedCtx({ unassignedCount: 2 }))).toBe(
      WizardStep.Assign,
    );
  });
});

describe("canAdvanceWizardStep", () => {
  const shortPath = buildVisibleStepIndices(false, false);

  it("is false when current step is max reachable (last step)", () => {
    expect(canAdvanceWizardStep(WizardStep.Completed, shortPath, WizardStep.Completed)).toBe(false);
  });

  it("is false when current step is max reachable (mid-path block)", () => {
    expect(canAdvanceWizardStep(WizardStep.Term, shortPath, WizardStep.Term)).toBe(false);
  });

  it("is true when max reachable is ahead on the path", () => {
    expect(canAdvanceWizardStep(WizardStep.Term, shortPath, WizardStep.Program)).toBe(true);
  });
});
