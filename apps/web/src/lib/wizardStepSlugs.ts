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

/** Typed href for TanStack Router `navigate({ to })` / `<Link to>`. */
export type WizardStepHref = `/schedule/step/${WizardStepSlug}`;

export function wizardStepToHref(step: WizardStep): WizardStepHref {
  return `/schedule/step/${wizardStepToSlug(step)}`;
}
