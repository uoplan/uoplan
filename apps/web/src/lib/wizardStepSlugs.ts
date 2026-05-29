import { WizardStep } from "./wizardSteps";
import type { ScheduleStepId } from "./scheduleDashboard";

/**
 * Map a {@link WizardStep} to the dashboard accordion section it should open.
 * The standalone wizard sub-pages were removed in favour of inline collapsible
 * sections on `/schedule`, so navigation now targets `/schedule?step=<id>`.
 * "Completed courses" was merged into the Program & courses section.
 */
function wizardStepToScheduleStep(step: WizardStep): ScheduleStepId | undefined {
  switch (step) {
    case WizardStep.Term:
      return undefined;
    case WizardStep.Program:
    case WizardStep.Completed:
      return "program";
    case WizardStep.Options:
      return "options";
    case WizardStep.Assign:
      return "assign";
    default:
      return undefined;
  }
}

type WizardStepNavigation = {
  to: "/schedule";
  search: { step?: ScheduleStepId };
};

export function wizardStepToNavigation(step: WizardStep): WizardStepNavigation {
  return { to: "/schedule", search: { step: wizardStepToScheduleStep(step) } };
}
