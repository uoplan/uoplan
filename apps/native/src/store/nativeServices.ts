/**
 * Native {@link AppServices} adapter for `@uoplan/store`.
 *
 * Phase 4 of the modularization plan: wire the shared planner store into Expo
 * via platform services. Screens still use Context providers today; mount
 * `AppStoreProvider` with {@link createNativeAppServices} as domains migrate.
 */
import { Directory, File, Paths } from "expo-file-system";
import { Alert } from "react-native";

import { tr } from "@uoplan/i18n";
import type { AppServices } from "@uoplan/store/services";

import { createDataTransport } from "@/data/data-client";

const STATE_DIR_NAME = "uoplan-state";
const ENCODED_STATE_FILE = "encoded-state.txt";

function ensureStateDir(): Directory {
  const dir = new Directory(Paths.document, STATE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

function encodedStateFile(): File {
  return new File(ensureStateDir(), ENCODED_STATE_FILE);
}

async function readEncodedState(): Promise<string | null> {
  try {
    const file = encodedStateFile();
    if (!file.exists) return null;
    const text = await file.text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function writeEncodedState(base64: string): Promise<void> {
  try {
    await encodedStateFile().write(base64);
  } catch {
    // Best-effort persistence — never break generation for a cache write.
  }
}

async function removeEncodedState(): Promise<void> {
  try {
    const file = encodedStateFile();
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}

/**
 * Build native AppServices. Navigation targets are no-ops until the store is
 * mounted under Expo Router (inject real navigation when wiring the provider).
 */
export function createNativeAppServices(overrides: Partial<AppServices> = {}): AppServices {
  // One transport instance shared by fetchBytes/optionalBytes for this services
  // object (manifest is loaded lazily inside createDataTransport).
  const fetchBytes = createDataTransport();

  const defaults: AppServices = {
    navigation: {
      toWizardStep: () => {
        // Wired when personalize routes adopt the store.
      },
      toCalendar: () => {
        // Wired when schedule tab adopts the store.
      },
    },
    persistence: {
      readEncodedState,
      writeEncodedState,
      removeEncodedState,
      now: () => Date.now(),
    },
    location: {
      getSearch: () => "",
      getHref: () => "",
      getOrigin: () => "https://uoplan.party",
      replaceHref: () => {},
      clearSearch: () => {},
    },
    notifications: {
      show: ({ title, message }) => {
        Alert.alert(title, message);
      },
    },
    data: {
      fetchBytes,
      optionalBytes: async (id) => {
        try {
          return await fetchBytes(id);
        } catch {
          return null;
        }
      },
    },
    scheduleRunner: {
      // Full runner lands when generate-schedule is unified with the store
      // ScheduleRunnerService (Phase 3/4). Until then generation stays on the
      // native lib path.
      run: async () => null,
      cancel: () => {},
      prewarm: async () => {},
    },
    engine: {
      retimetableFixedSet: async () => null,
    },
    share: {
      getOrigin: () => "https://uoplan.party",
      copyText: async () => {},
      buildShareUrl: () => "https://uoplan.party",
    },
    tr,
    diagnostics: {
      assignmentDebugEnabled: () => false,
      debugAssignments: () => {},
    },
  };

  return {
    navigation: { ...defaults.navigation, ...overrides.navigation },
    persistence: { ...defaults.persistence, ...overrides.persistence },
    location: { ...defaults.location, ...overrides.location },
    notifications: { ...defaults.notifications, ...overrides.notifications },
    data: { ...defaults.data, ...overrides.data },
    scheduleRunner: { ...defaults.scheduleRunner, ...overrides.scheduleRunner },
    engine: { ...defaults.engine, ...overrides.engine },
    share: { ...defaults.share, ...overrides.share },
    tr: overrides.tr ?? defaults.tr,
    diagnostics: { ...defaults.diagnostics, ...overrides.diagnostics },
  };
}
