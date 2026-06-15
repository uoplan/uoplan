import type { AppServiceOverrides, AppServices } from "./services";

const noop = () => {};

function missingBytes(id: string): Promise<Uint8Array> {
  return Promise.reject(new Error(`No test data service configured for ${id}`));
}

export function createTestAppServices(overrides: AppServiceOverrides = {}): AppServices {
  const defaults: AppServices = {
    navigation: {
      toWizardStep: noop,
      toCalendar: noop,
    },
    persistence: {
      readEncodedState: () => null,
      writeEncodedState: noop,
      removeEncodedState: noop,
      flushEncodedState: noop,
      now: () => 0,
    },
    location: {
      getSearch: () => "",
      getHref: () => "",
      getOrigin: () => "",
      replaceHref: noop,
      clearSearch: noop,
    },
    notifications: {
      show: noop,
    },
    data: {
      fetchBytes: missingBytes,
      optionalBytes: () => Promise.resolve(null),
    },
    scheduleRunner: {
      run: () => Promise.resolve(null),
      cancel: noop,
      prewarm: () => Promise.resolve(),
    },
    engine: {
      retimetableFixedSet: () => Promise.resolve(null),
    },
    share: {
      getOrigin: () => "",
      copyText: noop,
      buildShareUrl: () => "",
    },
    tr: (id) => id,
    diagnostics: {
      assignmentDebugEnabled: () => false,
      debugAssignments: noop,
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
