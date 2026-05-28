import { WizardStep } from "./wizardSteps";

const WIZARD_STEP_SLUGS = ["term", "program", "completed", "options", "requirements"] as const;

type WizardStepSlug = (typeof WIZARD_STEP_SLUGS)[number];

function wizardStepToSlug(step: WizardStep): WizardStepSlug {
  return WIZARD_STEP_SLUGS[step];
}

/** Typed href for TanStack Router `navigate({ to })` / `<Link to>`. */
type WizardStepHref = `/schedule/${WizardStepSlug}` | "/schedule";

export function wizardStepToHref(step: WizardStep): WizardStepHref {
  if (step === WizardStep.Term) return "/schedule";
  return `/schedule/${wizardStepToSlug(step)}`;
}
