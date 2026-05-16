import type { WizardStep } from "./wizardSteps";

export const WIZARD_STEP_SLUGS = [
  "term",
  "mode",
  "program",
  "completed",
  "options",
  "assign",
  "generate",
] as const;

export type WizardStepSlug = (typeof WIZARD_STEP_SLUGS)[number];

export function wizardStepToSlug(step: WizardStep): WizardStepSlug {
  return WIZARD_STEP_SLUGS[step];
}

export function slugToWizardStep(slug: string): WizardStep | null {
  const idx = WIZARD_STEP_SLUGS.indexOf(slug as WizardStepSlug);
  return idx >= 0 ? (idx as WizardStep) : null;
}
