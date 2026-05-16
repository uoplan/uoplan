import type { DecodedState } from "schedule";
import { nodeHasOptionGroups } from "../components/requirements/requirementUtils";
import { normalizeActiveStep, WizardStep } from "./wizardSteps";
import type { AppStore } from "../store/types";
import { navigateToCalendar, navigateToWizardStep } from "./appNavigation";

/**
 * After {@link AppStore.loadEncodedState}, optionally sync the URL with **legacy** navigation
 * fields from the protobuf (`activeStep`, `showCalendar`).
 *
 * Current encodings always store `activeStep: 0` and `showCalendar: false` (navigation lives in
 * the pathname only). If we navigated on every hydrate, we would `replace` away the real URL
 * (e.g. `/step/generate`) and send users to `/step/term` after every refresh — so we no-op when
 * those fields carry no information.
 */
export function applyHydrationNavigation(decoded: DecodedState, getState: () => AppStore): void {
  const hasStoredNavigationHint = (decoded.activeStep ?? 0) !== 0 || decoded.showCalendar === true;

  if (!hasStoredNavigationHint) {
    return;
  }

  const state = getState();
  const needsOptionsStep = state.requirementTreeWithStatus.some(nodeHasOptionGroups);
  const needsAssignStep = state.unassignedCompletedCourses.length > 0;
  const normalized = normalizeActiveStep(
    decoded.activeStep ?? 0,
    needsOptionsStep,
    needsAssignStep,
  );

  state.touchWizardFurthestStep(normalized);

  if (decoded.showCalendar) {
    const wm = state.wizardMode ?? decoded.wizardMode;
    navigateToCalendar(wm === "basic" ? "basic" : "advanced", { replace: true });
    return;
  }

  if (state.wizardMode === "basic" && normalized > WizardStep.Mode) {
    navigateToCalendar("basic", { replace: true });
    return;
  }

  navigateToWizardStep(normalized, { replace: true });
}
