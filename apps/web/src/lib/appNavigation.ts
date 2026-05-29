import type { WizardStep } from "./wizardSteps";
import { wizardStepToNavigation } from "./wizardStepSlugs";
import { getRouterInstance } from "../routerRef";

export function navigateToWizardStep(step: WizardStep, options?: { replace?: boolean }): void {
  const router = getRouterInstance();
  if (!router) return;
  const { to, search } = wizardStepToNavigation(step);
  void router.navigate({
    to,
    search,
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
