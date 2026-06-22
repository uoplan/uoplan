import {
  ANALYTICS_OPT_OUT_STORAGE_KEY,
  noopAnalytics,
  resolveAnalyticsConfig,
  shouldEnableCapture,
} from "@uoplan/analytics";
import type {
  AnalyticsClient,
  AnalyticsEventMap,
  AnalyticsEventName,
  PageviewProperties,
  ResolvedAnalyticsConfig,
} from "@uoplan/analytics";
import type { CaptureResult, PostHog, PostHogConfig } from "posthog-js";

type PostHogLoader = () => Promise<PostHog>;
const URL_PROPERTY_DENYLIST = ["$current_url", "$referrer"] as const;

interface WebAnalyticsClientOptions {
  config: ResolvedAnalyticsConfig;
  enabled: boolean;
  initialPageview?: PageviewProperties;
  loadPostHog?: PostHogLoader;
}

let analyticsClient: AnalyticsClient = noopAnalytics;
let analyticsInitialized = false;

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    return null;
  }
  return null;
}

export function readAnalyticsOptOutPreference(): boolean {
  return getStorage()?.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY) === "1";
}

export function writeAnalyticsOptOutPreference(optedOut: boolean): void {
  getStorage()?.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, optedOut ? "1" : "0");
}

async function loadDefaultPostHog(): Promise<PostHog> {
  const mod = await import("posthog-js");
  return mod.default;
}

function capturePostHogEvent<E extends AnalyticsEventName>(
  posthog: PostHog,
  event: E,
  props?: AnalyticsEventMap[E],
): void {
  posthog.capture(event, props);
}

function stripUrlProperties(captureResult: CaptureResult | null): CaptureResult | null {
  if (!captureResult) return null;
  const properties = { ...captureResult.properties };
  for (const key of URL_PROPERTY_DENYLIST) delete properties[key];
  return { ...captureResult, properties };
}

export function buildWebAnalyticsClient({
  config,
  enabled,
  initialPageview,
  loadPostHog = loadDefaultPostHog,
}: WebAnalyticsClientOptions): AnalyticsClient {
  if (!enabled) return noopAnalytics;

  let posthog: PostHog | null = null;
  let loadPromise: Promise<void> | null = null;
  let pendingInitialPageview: PageviewProperties | null = initialPageview ?? null;
  let capturedInitialPageview = false;

  const capturePageviewNow = (properties?: PageviewProperties) => {
    if (!posthog || readAnalyticsOptOutPreference()) return;
    capturedInitialPageview = true;
    posthog.capture("$pageview", properties);
  };

  const ensureLoaded = () => {
    if (posthog || loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const instance = await loadPostHog();
        const optedOut = readAnalyticsOptOutPreference();
        const options: Partial<PostHogConfig> = {
          api_host: config.host,
          ui_host: config.uiHost,
          person_profiles: "always",
          persistence: "localStorage+cookie",
          disable_session_recording: true,
          autocapture: true,
          capture_pageview: false,
          capture_pageleave: true,
          mask_personal_data_properties: true,
          custom_personal_data_properties: ["q"],
          before_send: stripUrlProperties,
          opt_out_capturing_by_default: optedOut,
        };
        instance.init(config.key, options);
        posthog = instance;
        if (!capturedInitialPageview && pendingInitialPageview) {
          capturePageviewNow(pendingInitialPageview);
          pendingInitialPageview = null;
        }
      } catch {
        loadPromise = null;
      }
    })();

    return loadPromise;
  };

  void ensureLoaded();

  return {
    capture: (event, props) => {
      if (!posthog || readAnalyticsOptOutPreference()) return;
      capturePostHogEvent(posthog, event, props);
    },
    capturePageview: (properties) => {
      if (!posthog) {
        if (!capturedInitialPageview && !pendingInitialPageview) {
          pendingInitialPageview = properties ?? {};
        }
        return;
      }
      capturePageviewNow(properties);
    },
    optIn: () => {
      writeAnalyticsOptOutPreference(false);
      posthog?.opt_in_capturing();
      if (posthog) capturePostHogEvent(posthog, "analytics_opted_in");
    },
    optOut: () => {
      writeAnalyticsOptOutPreference(true);
      posthog?.opt_out_capturing();
    },
    isOptedOut: readAnalyticsOptOutPreference,
  };
}

export function initializeAnalytics(initialPageview?: PageviewProperties): AnalyticsClient {
  if (analyticsInitialized) return analyticsClient;
  analyticsInitialized = true;

  const config = resolveAnalyticsConfig({
    key: import.meta.env.VITE_POSTHOG_KEY,
    host: import.meta.env.VITE_POSTHOG_HOST,
    uiHost: import.meta.env.VITE_POSTHOG_UI_HOST,
  });
  analyticsClient = buildWebAnalyticsClient({
    config,
    enabled: shouldEnableCapture({
      key: config.key,
      isProduction: import.meta.env.PROD,
      debug: import.meta.env.VITE_POSTHOG_DEBUG === "1",
    }),
    initialPageview,
  });
  return analyticsClient;
}

export function getAnalytics(): AnalyticsClient {
  return analyticsClient;
}
