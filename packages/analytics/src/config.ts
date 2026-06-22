/**
 * Shared PostHog configuration for the uoplan web + native apps.
 *
 * The project key is a PostHog **publishable** key (`phc_` prefix, client-side).
 * Like the Turnstile site key and the VAPID public key already committed in this
 * repo, it is safe to embed in the client bundle — it is not a secret. Apps may
 * still override any of these via env (`VITE_POSTHOG_*` on web,
 * `EXPO_PUBLIC_POSTHOG_*` on native).
 */

/** Publishable PostHog project key (EU project). */
export const DEFAULT_POSTHOG_KEY = "phc_BA34aHevue4iKEFtPauesTGycdNmxUJNCr4NhDJHFdYi";

/** Ingest host — the self-hosted PostHog managed reverse proxy. */
export const DEFAULT_POSTHOG_HOST = "https://t.uoplan.party";

/** PostHog app/UI host for the EU cloud region (used by `ui_host`). */
export const DEFAULT_POSTHOG_UI_HOST = "https://eu.posthog.com";

/**
 * Storage key under which each app persists the user's analytics opt-out
 * preference. Persisting a user-expressed opt-out is a strictly-necessary,
 * consent-exempt use of local storage even when analytics itself is cookieless.
 */
export const ANALYTICS_OPT_OUT_STORAGE_KEY = "uoplan:analytics-opt-out";

export interface AnalyticsConfigOverrides {
  key?: string | null;
  host?: string | null;
  uiHost?: string | null;
}

export interface ResolvedAnalyticsConfig {
  key: string;
  host: string;
  uiHost: string;
}

/** Merge optional env overrides with the committed defaults. */
export function resolveAnalyticsConfig(
  overrides: AnalyticsConfigOverrides = {},
): ResolvedAnalyticsConfig {
  return {
    key: overrides.key?.trim() || DEFAULT_POSTHOG_KEY,
    host: overrides.host?.trim() || DEFAULT_POSTHOG_HOST,
    uiHost: overrides.uiHost?.trim() || DEFAULT_POSTHOG_UI_HOST,
  };
}

/**
 * Whether analytics capture should initialise at all. We only send events in
 * production (so dev/test never pollute prod data), unless a platform passes
 * `debug` to opt in locally. A missing key disables capture entirely.
 */
export function shouldEnableCapture(opts: {
  key: string;
  isProduction: boolean;
  debug?: boolean;
}): boolean {
  if (!opts.key) return false;
  return opts.isProduction || opts.debug === true;
}
