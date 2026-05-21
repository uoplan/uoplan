import type { WizardStep } from "./wizardSteps";

const WIZARD_STEP_SLUGS = ["term", "program", "completed", "options", "assign"] as const;

type WizardStepSlug = (typeof WIZARD_STEP_SLUGS)[number];

function wizardStepToSlug(step: WizardStep): WizardStepSlug {
  return WIZARD_STEP_SLUGS[step];
}

/** Typed href for TanStack Router `navigate({ to })` / `<Link to>`. */
type WizardStepHref = `/schedule/step/${WizardStepSlug}`;

export function wizardStepToHref(step: WizardStep): WizardStepHref {
  return `/schedule/step/${wizardStepToSlug(step)}`;
}
