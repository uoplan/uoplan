import type { WizardStep } from "./wizardSteps";
import { wizardStepToHref } from "./wizardStepSlugs";
import { getRouterInstance } from "../routerRef";

export function navigateToWizardStep(step: WizardStep, options?: { replace?: boolean }): void {
  const router = getRouterInstance();
  if (!router) return;
  void router.navigate({
    to: wizardStepToHref(step),
    replace: options?.replace ?? false,
  });
}

export function navigateToCalendar(options?: { replace?: boolean }): void {
  const router = getRouterInstance();
  if (!router) return;
  void router.navigate({
    to: "/schedule/calendar",
    replace: options?.replace ?? false,
  });
}
