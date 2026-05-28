import type { DecodedState } from "@uoplan/schedule";
import { WizardStep } from "./wizardSteps";
import type { AppStore } from "../store/types";
import { navigateToCalendar, navigateToWizardStep } from "./appNavigation";

/**
 * After {@link AppStore.loadEncodedState}, optionally sync the URL with **legacy** navigation
 * fields from the protobuf (`activeStep`, `showCalendar`).
 *
 * Current encodings always store `activeStep: 0` and `showCalendar: false` (navigation lives in
 * the pathname only). If we navigated on every hydrate, we would `replace` away the real URL
 * (e.g. `/schedule/program`) and send users to `/schedule/term` after every refresh — so we no-op when
 * those fields carry no information.
 */
export function applyHydrationNavigation(decoded: DecodedState, _getState: () => AppStore): void {
  const hasStoredNavigationHint = (decoded.activeStep ?? 0) !== 0 || decoded.showCalendar === true;

  if (!hasStoredNavigationHint) {
    return;
  }

  const activeStep = Math.min(
    WizardStep.Assign,
    Math.max(WizardStep.Term, decoded.activeStep ?? WizardStep.Term),
  ) as WizardStep;

  if (decoded.showCalendar) {
    navigateToCalendar({ replace: true });
    return;
  }

  navigateToWizardStep(activeStep, { replace: true });
}
