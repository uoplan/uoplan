import { describe, expect, it } from "vitest";
import { canProceedFromWizardStep, WizardStep } from "./wizardSteps";
import type { WizardProceedContext } from "./wizardSteps";

function baseProceedCtx(overrides: Partial<WizardProceedContext> = {}): WizardProceedContext {
  return {
    hasTerms: true,
    selectedTermId: "t1",
    cacheLoaded: true,
    firstYear: 2024,
    hasProgram: true,
    missingOptions: false,
    needsOptionsStep: false,
    unassignedCount: 0,
    ...overrides,
  };
}

describe("canProceedFromWizardStep", () => {
  it("requires loaded terms, a selected term, and cache before program", () => {
    expect(canProceedFromWizardStep(WizardStep.Term, baseProceedCtx())).toBe(true);
    expect(canProceedFromWizardStep(WizardStep.Term, baseProceedCtx({ hasTerms: false }))).toBe(
      false,
    );
    expect(
      canProceedFromWizardStep(WizardStep.Term, baseProceedCtx({ selectedTermId: null })),
    ).toBe(false);
    expect(canProceedFromWizardStep(WizardStep.Term, baseProceedCtx({ cacheLoaded: false }))).toBe(
      false,
    );
  });

  it("requires first year and program before completed courses", () => {
    expect(canProceedFromWizardStep(WizardStep.Program, baseProceedCtx())).toBe(true);
    expect(canProceedFromWizardStep(WizardStep.Program, baseProceedCtx({ firstYear: null }))).toBe(
      false,
    );
    expect(
      canProceedFromWizardStep(WizardStep.Program, baseProceedCtx({ hasProgram: false })),
    ).toBe(false);
  });

  it("always allows leaving completed courses", () => {
    expect(canProceedFromWizardStep(WizardStep.Completed, baseProceedCtx())).toBe(true);
  });

  it("requires option selections only when the options step is needed", () => {
    expect(
      canProceedFromWizardStep(
        WizardStep.Options,
        baseProceedCtx({ needsOptionsStep: true, missingOptions: true }),
      ),
    ).toBe(false);
    expect(
      canProceedFromWizardStep(
        WizardStep.Options,
        baseProceedCtx({ needsOptionsStep: false, missingOptions: true }),
      ),
    ).toBe(true);
  });

  it("requires all completed courses to be assigned", () => {
    expect(canProceedFromWizardStep(WizardStep.Assign, baseProceedCtx())).toBe(true);
    expect(
      canProceedFromWizardStep(WizardStep.Assign, baseProceedCtx({ unassignedCount: 1 })),
    ).toBe(false);
  });
});
