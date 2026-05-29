import type { DecodedState } from "@uoplan/core";
import { WizardStep } from "./wizardSteps";
import type { NavigationService } from "../store/services";

/**
 * After {@link AppStore.loadEncodedState}, optionally sync the URL with **legacy** navigation
 * fields from the protobuf (`activeStep`, `showCalendar`).
 *
 * Current encodings always store `activeStep: 0` and `showCalendar: false` (navigation lives in
 * the pathname only). If we navigated on every hydrate, we would `replace` away the real URL
 * (e.g. `/schedule?step=program`) and send users to the dashboard top after every refresh — so we
 * no-op when those fields carry no information.
 */
export function applyHydrationNavigation(
  decoded: DecodedState,
  navigation: NavigationService,
): void {
  const hasStoredNavigationHint = (decoded.activeStep ?? 0) !== 0 || decoded.showCalendar === true;

  if (!hasStoredNavigationHint) {
    return;
  }

  const activeStep = Math.min(
    WizardStep.Assign,
    Math.max(WizardStep.Term, decoded.activeStep ?? WizardStep.Term),
  ) as WizardStep;

  if (decoded.showCalendar) {
    navigation.toCalendar({ replace: true });
    return;
  }

  navigation.toWizardStep(activeStep, { replace: true });
}
