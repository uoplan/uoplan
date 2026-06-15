/**
 * Cross-platform i18n core.
 *
 * The portable, platform-agnostic translation surface shared by every shell
 * (web + native): the Lingui `i18n` singleton, the `tr` / `useTr` helpers,
 * locale-aware number formatting, and pure locale negotiation
 * (`normalizeLocale` / `detectPreferredLocale`).
 *
 * Platform-specific concerns live in each app's adapter, NOT here:
 *   - catalog loading (web: Vite `.po` import; native: bundled catalog),
 *   - locale persistence + environment detection (web: `localStorage` +
 *     `navigator`; native: `expo-localization` + `AsyncStorage`),
 *   - activation/bootstrap (`dynamicActivate` / `initializeI18n`).
 *
 * Keep this module free of `node:*`/DOM/React Native imports so it resolves
 * identically under Vite and Metro.
 */
import { i18n } from "@lingui/core";
import { I18nProvider, useLingui } from "@lingui/react";

export const APP_LOCALES = ["en", "fr-CA"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

function toSupportedLocale(raw: string | null | undefined): AppLocale | null {
  if (!raw) return null;
  const locale = raw.trim().toLowerCase();
  if (locale === "fr" || locale.startsWith("fr-")) return "fr-CA";
  if (locale === "en" || locale.startsWith("en-")) return "en";
  return null;
}

/** Coerce any locale string to one of the supported app locales. */
export function normalizeLocale(raw: string | null | undefined): AppLocale {
  return toSupportedLocale(raw) ?? DEFAULT_LOCALE;
}

/**
 * Negotiate the preferred app locale from a stored preference and an ordered
 * list of environment locales (e.g. `navigator.languages` on web,
 * `getLocales()` on native). Pure: the caller supplies the platform inputs.
 */
export function detectPreferredLocale(input: {
  storedLocale?: string | null;
  navigatorLocales?: readonly string[];
}): AppLocale {
  const stored = toSupportedLocale(input.storedLocale);
  if (stored) return stored;

  for (const locale of input.navigatorLocales ?? []) {
    const supported = toSupportedLocale(locale);
    if (supported) return supported;
  }

  return DEFAULT_LOCALE;
}

/** Translate a message id (with optional ICU values) using the active locale. */
export function tr(id: string, values?: Record<string, unknown>): string {
  return i18n._({
    id,
    values,
  });
}

/**
 * Subscribe a React component to locale changes and return the `tr` helper.
 *
 * `tr()` reads the active locale at call time but does not itself trigger a
 * re-render, so any component rendering translated text must call this hook
 * (it wraps Lingui's `useLingui()`). Returns `tr` for convenience
 * (`const tr = useTr()`); non-React code keeps importing `tr` directly.
 */
export function useTr(): typeof tr {
  useLingui();
  return tr;
}

/** Locale-aware number formatting (e.g. `12,000` en · `12 000` fr-CA). */
export function formatLocaleNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = i18n.locale && i18n.locale.length > 0 ? i18n.locale : DEFAULT_LOCALE;
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Re-export Lingui's `<I18nProvider>` from the SAME `@lingui/react` module that
 * `useTr`/`useLingui` (above) resolve. Every shell MUST mount the provider via
 * this re-export rather than importing `@lingui/react` directly: under pnpm,
 * `@lingui/react` is keyed per peer `react` version, so a shell that pins a
 * different `react` (e.g. Expo's bundled copy vs the workspace's) would resolve
 * a SECOND `@lingui/react` with its own React context — the provider it renders
 * would then be invisible to `useLingui`, throwing "useLingui hook was used
 * without I18nProvider". Sharing this single instance guarantees one context.
 */
export { i18n, I18nProvider };
