import { notifications } from "@mantine/notifications";
import { runTimetableFixedSet } from "@uoplan/core";
import type { AppServices, RetimetableFixedSetInput, WizardStepLike } from "@uoplan/store/services";
import { tr } from "../i18n";
import { navigateToCalendar, navigateToWizardStep } from "../lib/appNavigation";
import { buildShareUrl } from "../lib/buildShareUrl";
import { flushPersistedAppState } from "../lib/persistAppState";
import { fetchProtoBytes, optionalProtoBytes } from "../lib/protoFetch";
import { getActiveSchool } from "../lib/activeSchool";
import { stateStorageKey } from "./constants";
import { getEffectiveCatalogue } from "@uoplan/store/slices/catalogueUtils";
import type { WizardStep } from "../lib/wizardSteps";

function currentWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function storageKey(): string {
  return stateStorageKey(getActiveSchool());
}

function readEncodedState(): string | null {
  return currentWindow()?.localStorage.getItem(storageKey()) ?? null;
}

function writeEncodedState(base64: string): void {
  currentWindow()?.localStorage.setItem(storageKey(), base64);
}

function removeEncodedState(): void {
  currentWindow()?.localStorage.removeItem(storageKey());
}

function clearSearch(): void {
  const w = currentWindow();
  if (!w) return;
  const url = new URL(w.location.href);
  url.search = "";
  w.history.replaceState({}, "", url);
}

async function retimetableFixedSet(input: RetimetableFixedSetInput) {
  // Preserve the exact references the store holds so getEffectiveCatalogue's
  // identity memo (and thus the WASM engine memo) stays warm across swap calls.
  const completedCourses = (input.completedCourses ?? []) as string[];
  const effectiveCatalogue =
    getEffectiveCatalogue(input.catalogue, input.yearCatalogueCourses ?? null, completedCourses) ??
    input.catalogue;
  // Lazily pull just the WASM engine glue (@uoplan/engine + engineBridge) so it
  // stays out of the initial route bundle; it's only needed once the user swaps
  // sections. runTimetableFixedSet is a static import — it already ships in the
  // entry via the store, so importing @uoplan/core dynamically would only bloat
  // the shared initial chunk without deferring anything.
  const { getEngineSync } = await import("../lib/engine/engineHost");
  const engine = getEngineSync(effectiveCatalogue, input.schedulesData);
  if (!engine) return null;
  return runTimetableFixedSet(
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
      school: input.school,
    },
    input.cache,
  );
}

/**
 * Lazily load the Comlink schedule-worker client. Keeping it behind a dynamic
 * import keeps the worker glue (comlink + generateSchedulesAction) out of the
 * initial route bundle; it's only needed once a generation actually runs.
 */
let scheduleWorkerClientPromise: ReturnType<typeof importScheduleWorkerClient> | null = null;
let cancelInFlightGeneration: (() => void) | null = null;
function importScheduleWorkerClient() {
  return import("../workers/scheduleWorkerClient");
}
async function loadScheduleWorkerClient() {
  scheduleWorkerClientPromise ??= importScheduleWorkerClient();
  const client = await scheduleWorkerClientPromise;
  cancelInFlightGeneration = client.cancelScheduleGeneration;
  return client;
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
      run: async (state, mode) => {
        const client = await loadScheduleWorkerClient();
        return client.runScheduleGeneration(state, mode);
      },
      // cancel is sync; if no run/prewarm has loaded the client yet there is
      // nothing in flight to cancel, so a no-op is correct.
      cancel: () => cancelInFlightGeneration?.(),
      prewarm: async (state) => {
        const client = await loadScheduleWorkerClient();
        return client.prewarmScheduleWorker(state);
      },
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
