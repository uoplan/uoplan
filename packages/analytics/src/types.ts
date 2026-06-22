import type { AnalyticsEventMap, AnalyticsEventName } from "./events";

export interface PageviewProperties {
  /** The current route path (e.g. `/schedule`). */
  path?: string;
  /** Optional document/screen title. */
  title?: string;
}

/**
 * Platform-agnostic analytics surface. The web app implements this over
 * `posthog-js` and the native app over `posthog-react-native`; feature code
 * depends only on this interface + the shared event taxonomy.
 *
 * All methods are no-ops when capture is disabled (no key, dev/test, or the
 * user has opted out), so callers never need to guard.
 */
export interface AnalyticsClient {
  /** Capture a typed product event. */
  capture<E extends AnalyticsEventName>(event: E, props?: AnalyticsEventMap[E]): void;
  /** Capture a `$pageview` (web) / `$screen` (native) for SPA navigations. */
  capturePageview(properties?: PageviewProperties): void;
  /** Re-enable capture and persist the preference. */
  optIn(): void;
  /** Disable capture and persist the preference. */
  optOut(): void;
  /** Whether the user has opted out of capture. */
  isOptedOut(): boolean;
}

/** A client that does nothing — used when capture is disabled. */
export const noopAnalytics: AnalyticsClient = {
  capture: () => {},
  capturePageview: () => {},
  optIn: () => {},
  optOut: () => {},
  isOptedOut: () => false,
};
