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

export function navigateToCalendar(
  variant: "basic" | "advanced",
  options?: { replace?: boolean },
): void {
  const router = getRouterInstance();
  if (!router) return;
  void router.navigate({
    to: variant === "basic" ? "/calendar/basic" : "/calendar/advanced",
    replace: options?.replace ?? false,
  });
}
