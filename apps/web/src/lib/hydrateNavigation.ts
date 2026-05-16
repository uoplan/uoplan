import type { DecodedState } from "schedule";
import { nodeHasOptionGroups } from "../components/requirements/requirementUtils";
import { normalizeActiveStep, WizardStep } from "./wizardSteps";
import type { AppStore } from "../store/types";
import { navigateToCalendar, navigateToWizardStep } from "./appNavigation";

/**
 * After {@link AppStore.loadEncodedState}, sync the visible URL with legacy navigation fields.
 */
export function applyHydrationNavigation(decoded: DecodedState, getState: () => AppStore): void {
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
