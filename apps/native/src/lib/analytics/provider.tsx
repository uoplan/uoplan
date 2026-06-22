import { usePathname } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";

import {
  noopAnalytics,
  resolveAnalyticsConfig,
  shouldEnableCapture,
  type AnalyticsClient,
} from "@uoplan/analytics";

import { createPostHogAnalyticsClient, setCurrentAnalyticsClient } from "@/lib/analytics/client";
import { readAnalyticsOptOut, writeAnalyticsOptOut } from "@/lib/analytics/analytics-storage";

const analyticsConfig = resolveAnalyticsConfig({
  key: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
});

const analyticsDebug = process.env.EXPO_PUBLIC_POSTHOG_DEBUG === "1";

const captureEnabled = shouldEnableCapture({
  key: analyticsConfig.key,
  isProduction: !__DEV__,
  debug: analyticsDebug,
});

interface AnalyticsPreferenceContextValue {
  enabled: boolean;
  optedOut: boolean;
  loaded: boolean;
  setOptedOut(optedOut: boolean): void;
}

const AnalyticsClientContext = createContext<AnalyticsClient>(noopAnalytics);
const AnalyticsPreferenceContext = createContext<AnalyticsPreferenceContextValue>({
  enabled: false,
  optedOut: false,
  loaded: false,
  setOptedOut: () => {},
});

function AnalyticsScreenTracker() {
  const analytics = useAnalytics();
  const pathname = usePathname?.() ?? null;
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    analytics.capturePageview({ path: pathname });
  }, [analytics, pathname]);

  return null;
}

function AnalyticsRuntime({
  children,
  enabled,
  loaded,
  optedOut,
  setOptedOutState,
}: {
  children: ReactNode;
  enabled: boolean;
  loaded: boolean;
  optedOut: boolean;
  setOptedOutState: (optedOut: boolean) => void;
}) {
  const posthog = usePostHog();

  const persistPreference = useCallback(
    (nextOptedOut: boolean) => {
      setOptedOutState(nextOptedOut);
      void writeAnalyticsOptOut(nextOptedOut);
    },
    [setOptedOutState],
  );

  const client = useMemo(
    () =>
      enabled
        ? createPostHogAnalyticsClient({
            posthog,
            isOptedOut: () => optedOut,
            setOptedOut: persistPreference,
          })
        : noopAnalytics,
    [enabled, optedOut, persistPreference, posthog],
  );

  const setOptedOut = useCallback(
    (nextOptedOut: boolean) => {
      if (!enabled) {
        persistPreference(nextOptedOut);
        return;
      }
      if (nextOptedOut) {
        client.optOut();
      } else {
        client.optIn();
      }
    },
    [client, enabled, persistPreference],
  );

  useEffect(() => {
    setCurrentAnalyticsClient(client);
    return () => setCurrentAnalyticsClient(noopAnalytics);
  }, [client]);

  const preference = useMemo<AnalyticsPreferenceContextValue>(
    () => ({ enabled, loaded, optedOut, setOptedOut }),
    [enabled, loaded, optedOut, setOptedOut],
  );

  return (
    <AnalyticsClientContext.Provider value={client}>
      <AnalyticsPreferenceContext.Provider value={preference}>
        <AnalyticsScreenTracker />
        {children}
      </AnalyticsPreferenceContext.Provider>
    </AnalyticsClientContext.Provider>
  );
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [persistedOptOut, setPersistedOptOut] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void readAnalyticsOptOut().then((loadedOptOut) => {
      if (active) setPersistedOptOut(loadedOptOut);
    });
    return () => {
      active = false;
    };
  }, []);

  const loaded = persistedOptOut !== null;
  const optedOut = persistedOptOut ?? true;
  const enabled = captureEnabled && loaded;

  return (
    <PostHogProvider
      key={loaded ? "analytics-ready" : "analytics-loading"}
      apiKey={analyticsConfig.key}
      options={{
        host: analyticsConfig.host,
        persistence: "memory",
        enableSessionReplay: false,
        defaultOptIn: loaded && !optedOut,
        disabled: !enabled,
        captureAppLifecycleEvents: true,
      }}
      autocapture={{
        captureTouches: true,
        captureScreens: false,
      }}
      debug={analyticsDebug}
    >
      <AnalyticsRuntime
        enabled={enabled}
        loaded={loaded}
        optedOut={optedOut}
        setOptedOutState={setPersistedOptOut}
      >
        {children}
      </AnalyticsRuntime>
    </PostHogProvider>
  );
}

export function useAnalytics(): AnalyticsClient {
  return useContext(AnalyticsClientContext);
}

export function useAnalyticsPreference(): AnalyticsPreferenceContextValue {
  return useContext(AnalyticsPreferenceContext);
}
