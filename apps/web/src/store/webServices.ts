import { notifications } from "@mantine/notifications";
import { runTimetableFixedSet } from "@uoplan/core";
import type { AppServices, RetimetableFixedSetInput, WizardStepLike } from "@uoplan/store/services";
import { tr } from "../i18n";
import { navigateToCalendar, navigateToWizardStep } from "../lib/appNavigation";
import { buildShareUrl } from "../lib/buildShareUrl";
import { getEngineSync } from "../lib/engine/engineHost";
import { flushPersistedAppState } from "../lib/persistAppState";
import { fetchProtoBytes, optionalProtoBytes } from "../lib/protoFetch";
import {
  cancelScheduleGeneration,
  prewarmScheduleWorker,
  runScheduleGeneration,
} from "../workers/scheduleWorkerClient";
import { LOCAL_STORAGE_KEY } from "./constants";
import { getEffectiveCatalogue } from "./slices/catalogueUtils";
import type { WizardStep } from "../lib/wizardSteps";

function currentWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function readEncodedState(): string | null {
  return currentWindow()?.localStorage.getItem(LOCAL_STORAGE_KEY) ?? null;
}

function writeEncodedState(base64: string): void {
  currentWindow()?.localStorage.setItem(LOCAL_STORAGE_KEY, base64);
}

function removeEncodedState(): void {
  currentWindow()?.localStorage.removeItem(LOCAL_STORAGE_KEY);
}

function clearSearch(): void {
  const w = currentWindow();
  if (!w) return;
  const url = new URL(w.location.href);
  url.search = "";
  w.history.replaceState({}, "", url);
}

function retimetableFixedSet(input: RetimetableFixedSetInput) {
  // Preserve the exact references the store holds so getEffectiveCatalogue's
  // identity memo (and thus the WASM engine memo) stays warm across swap calls.
  const completedCourses = (input.completedCourses ?? []) as string[];
  const effectiveCatalogue =
    getEffectiveCatalogue(input.catalogue, input.yearCatalogueCourses ?? null, completedCourses) ??
    input.catalogue;
  const engine = getEngineSync(effectiveCatalogue, input.schedulesData);
  if (!engine) return Promise.resolve(null);
  return Promise.resolve(
    runTimetableFixedSet(
      engine,
      {
        courseCodes: [...input.courseCodes],
        constraints: input.constraints,
        seed: input.seed,
        includeClosedComponents: input.includeClosedComponents,
        virtualSectionsOnly: input.virtualSectionsOnly,
        virtualExemptCourses: [...(input.virtualExemptCourses ?? [])],
        applyBlacklist: input.applyBlacklist,
        blacklistedCourses: [...(input.blacklistedCourses ?? [])],
        optimizationPriorities: input.optimizationPriorities,
      },
      input.cache,
    ),
  );
}

/** Default web services backed by browser APIs and the app's router/worker/engine adapters. */
export function createWebAppServices(): AppServices {
  return {
    navigation: {
      toWizardStep: (step: WizardStepLike, options) =>
        navigateToWizardStep(step as WizardStep, options),
      toCalendar: navigateToCalendar,
    },
    persistence: {
      readEncodedState,
      writeEncodedState,
      removeEncodedState,
      flushEncodedState: flushPersistedAppState,
      now: Date.now,
    },
    location: {
      getSearch: () => currentWindow()?.location.search ?? "",
      getHref: () => currentWindow()?.location.href ?? "",
      getOrigin: () => currentWindow()?.location.origin ?? "",
      replaceHref: (nextHref) => currentWindow()?.history.replaceState({}, "", nextHref),
      clearSearch,
    },
    notifications: {
      show: ({ color, title, message }) => notifications.show({ color, title, message }),
    },
    data: {
      fetchBytes: fetchProtoBytes,
      optionalBytes: optionalProtoBytes,
    },
    scheduleRunner: {
      run: runScheduleGeneration,
      cancel: cancelScheduleGeneration,
      prewarm: prewarmScheduleWorker,
    },
    engine: {
      retimetableFixedSet,
    },
    share: {
      getOrigin: () => currentWindow()?.location.origin ?? "",
      copyText: (text) => currentWindow()?.navigator.clipboard?.writeText?.(text),
      buildShareUrl,
    },
    tr,
    diagnostics: {
      assignmentDebugEnabled: () =>
        currentWindow()?.localStorage.getItem("uoplanDebugAssignments") === "1",
      debugAssignments: (payload) => {
        // oxlint-disable-next-line no-console -- intentional opt-in assignment debug logging
        console.debug("[uoplan assignments]", payload);
      },
    },
  };
}
