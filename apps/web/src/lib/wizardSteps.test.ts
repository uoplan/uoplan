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
      WizardStep.Mode,
      WizardStep.Program,
      WizardStep.Completed,
      WizardStep.Options,
      WizardStep.Assign,
      WizardStep.Generate,
    ]);
  });

  it("skips options and assign when neither needed", () => {
    expect(buildVisibleStepIndices(false, false)).toEqual([
      WizardStep.Term,
      WizardStep.Mode,
      WizardStep.Program,
      WizardStep.Completed,
      WizardStep.Generate,
    ]);
  });

  it("includes only options when assign not needed", () => {
    expect(buildVisibleStepIndices(true, false)).toEqual([
      WizardStep.Term,
      WizardStep.Mode,
      WizardStep.Program,
      WizardStep.Completed,
      WizardStep.Options,
      WizardStep.Generate,
    ]);
  });

  it("includes only assign when options not needed", () => {
    expect(buildVisibleStepIndices(false, true)).toEqual([
      WizardStep.Term,
      WizardStep.Mode,
      WizardStep.Program,
      WizardStep.Completed,
      WizardStep.Assign,
      WizardStep.Generate,
    ]);
  });
});

describe("getNextStep / getPrevStep", () => {
  it("jumps from completed to generate when options and assign skipped", () => {
    expect(getNextStep(WizardStep.Completed, false, false)).toBe(WizardStep.Generate);
    expect(getPrevStep(WizardStep.Generate, false, false)).toBe(WizardStep.Completed);
  });

  it("goes through assign when only options skipped", () => {
    expect(getNextStep(WizardStep.Completed, false, true)).toBe(WizardStep.Assign);
    expect(getNextStep(WizardStep.Assign, false, true)).toBe(WizardStep.Generate);
    expect(getPrevStep(WizardStep.Assign, false, true)).toBe(WizardStep.Completed);
  });

  it("stays on last step", () => {
    expect(getNextStep(WizardStep.Generate, true, true)).toBe(WizardStep.Generate);
  });
});

describe("normalizeActiveStep", () => {
  it("maps skipped options step to generate or assign", () => {
    expect(normalizeActiveStep(WizardStep.Options, false, false)).toBe(WizardStep.Generate);
    expect(normalizeActiveStep(WizardStep.Options, false, true)).toBe(WizardStep.Assign);
  });

  it("maps skipped assign step to generate", () => {
    expect(normalizeActiveStep(WizardStep.Assign, true, false)).toBe(WizardStep.Generate);
  });

  it("leaves valid steps unchanged", () => {
    expect(normalizeActiveStep(WizardStep.Generate, false, false)).toBe(WizardStep.Generate);
  });
});

describe("furthestReachedDisplayIndex", () => {
  const skipBoth = [
    WizardStep.Term,
    WizardStep.Mode,
    WizardStep.Program,
    WizardStep.Completed,
    WizardStep.Generate,
  ];

  it("uses the visible index when furthest actual is on the list", () => {
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Generate)).toBe(4);
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Completed)).toBe(3);
  });

  it("maps past a dropped optional step to the next visible row", () => {
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Assign)).toBe(4);
    expect(furthestReachedDisplayIndex(skipBoth, WizardStep.Options)).toBe(4);
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
    expect(firstInteractiveStepAfter(WizardStep.Completed, false, false)).toBe(WizardStep.Generate);
    expect(firstInteractiveStepAfter(WizardStep.Options, true, false)).toBe(WizardStep.Generate);
    expect(firstInteractiveStepAfter(WizardStep.Options, false, true)).toBe(WizardStep.Assign);
  });

  it("skippedWizardStepIsPassed when furthest reaches the next step", () => {
    expect(skippedWizardStepIsPassed(WizardStep.Options, WizardStep.Assign, true, false)).toBe(
      false,
    );
    expect(skippedWizardStepIsPassed(WizardStep.Options, WizardStep.Generate, true, false)).toBe(
      false,
    );
    expect(skippedWizardStepIsPassed(WizardStep.Options, WizardStep.Generate, false, false)).toBe(
      true,
    );
    expect(skippedWizardStepIsPassed(WizardStep.Assign, WizardStep.Assign, false, false)).toBe(
      false,
    );
    expect(skippedWizardStepIsPassed(WizardStep.Assign, WizardStep.Generate, false, false)).toBe(
      true,
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

  it("allows proceeding past mode when term is complete", () => {
    expect(maxReachableWizardStep(false, false, baseProceedCtx())).toBe(WizardStep.Generate);
  });

  it("stops at mode when term incomplete", () => {
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

  it("reaches generate on shortest advanced path", () => {
    expect(maxReachableWizardStep(false, false, baseProceedCtx())).toBe(WizardStep.Generate);
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

  it("is false on generate", () => {
    expect(canAdvanceWizardStep(WizardStep.Generate, shortPath, WizardStep.Generate)).toBe(false);
  });

  it("is false when current step is max reachable", () => {
    expect(canAdvanceWizardStep(WizardStep.Mode, shortPath, WizardStep.Mode)).toBe(false);
  });

  it("is true when max reachable is ahead on the path", () => {
    expect(canAdvanceWizardStep(WizardStep.Mode, shortPath, WizardStep.Program)).toBe(true);
  });
});
