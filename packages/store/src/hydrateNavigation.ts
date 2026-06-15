import type { DecodedState } from "@uoplan/core";
import type { NavigationService, WizardStepLike } from "./services";

const WIZARD_STEP_TERM = 0;
const WIZARD_STEP_ASSIGN = 4;

/**
 * After {@link AppStore.loadEncodedState}, optionally sync navigation with **legacy**
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
    WIZARD_STEP_ASSIGN,
    Math.max(WIZARD_STEP_TERM, decoded.activeStep ?? WIZARD_STEP_TERM),
  ) as WizardStepLike;

  if (decoded.showCalendar) {
    navigation.toCalendar({ replace: true });
    return;
  }

  navigation.toWizardStep(activeStep, { replace: true });
}
