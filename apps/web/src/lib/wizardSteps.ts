export enum WizardStep {
  Term = 0,
  Program = 1,
  Completed = 2,
  Options = 3,
  Assign = 4,
}

export const ALL_WIZARD_STEP_INDICES = [
  WizardStep.Term,
  WizardStep.Program,
  WizardStep.Completed,
  WizardStep.Options,
  WizardStep.Assign,
] as const;

export type WizardProceedContext = {
  hasTerms: boolean;
  selectedTermId: string | null;
  cacheLoaded: boolean;
  firstYear: number | null;
  hasProgram: boolean;
  missingOptions: boolean;
  needsOptionsStep: boolean;
  unassignedCount: number;
};

export function canProceedFromWizardStep(step: WizardStep, ctx: WizardProceedContext): boolean {
  switch (step) {
    case WizardStep.Term:
      return ctx.hasTerms && Boolean(ctx.selectedTermId) && ctx.cacheLoaded;
    case WizardStep.Program:
      return ctx.firstYear !== null && ctx.hasProgram;
    case WizardStep.Completed:
      return true;
    case WizardStep.Options:
      return ctx.needsOptionsStep ? !ctx.missingOptions : true;
    case WizardStep.Assign:
      return ctx.unassignedCount === 0;
    default:
      return true;
  }
}
