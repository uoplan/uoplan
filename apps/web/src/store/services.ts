import type { WizardStep } from "../lib/wizardSteps";
import { navigateToCalendar, navigateToWizardStep } from "../lib/appNavigation";

/**
 * Imperative navigation seam used by the store outside the React tree (share hydration,
 * accepting a shared schedule). Injected via {@link createAppStore} so slices never import
 * the router/navigation modules directly and tests can supply a fake.
 */
export interface NavigationService {
  toWizardStep(step: WizardStep, options?: { replace?: boolean }): void;
  toCalendar(options?: { replace?: boolean }): void;
}

/** Services injected into the store at construction time. */
export interface AppServices {
  navigation: NavigationService;
}

/** Default services backed by the app's global router instance. */
export function createDefaultAppServices(): AppServices {
  return {
    navigation: {
      toWizardStep: navigateToWizardStep,
      toCalendar: navigateToCalendar,
    },
  };
}
