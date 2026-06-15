/**
 * Native i18n adapter.
 *
 * Re-exports the portable translation core (`@uoplan/i18n`) and adds the
 * platform-specific bootstrap for React Native: it bundles the compiled
 * catalogs (resolved through Metro's `@uoplan/i18n/catalogs/*` rewrite) and
 * negotiates the device locale via `expo-localization`'s `getLocales()`.
 *
 * Native components import `tr`/`useTr` (and the `AppLocale` type) from `@/i18n`
 * so they never reach past this adapter into Lingui directly. Persistence +
 * activation lifecycle live in `locale-provider.tsx` / `locale-storage.ts`.
 */
import { getLocales } from "expo-localization";

import {
  type AppLocale,
  APP_LOCALES,
  DEFAULT_LOCALE,
  detectPreferredLocale,
  i18n,
  tr,
  useTr,
} from "@uoplan/i18n";
import { messages as enMessages } from "@uoplan/i18n/catalogs/en";
import { messages as frCaMessages } from "@uoplan/i18n/catalogs/fr-CA";

const CATALOGS: Record<AppLocale, typeof enMessages> = {
  en: enMessages,
  "fr-CA": frCaMessages,
};

// Load every catalog once up front and activate `en` as a safe synchronous
// default, so any module-level `tr()` call before the provider mounts still
// resolves a string instead of throwing "no active locale".
for (const locale of APP_LOCALES) {
  i18n.load(locale, CATALOGS[locale]);
}
i18n.activate(DEFAULT_LOCALE);

/** Ordered BCP-47 locale tags reported by the device (most-preferred first). */
export function deviceLocaleTags(): string[] {
  // `getLocales()` reads a native constant; guard against the native module
  // being unavailable (e.g. a JS bundle hot-reloaded onto an older binary that
  // predates `expo-localization`) so locale detection degrades to the default
  // instead of throwing during provider mount.
  try {
    return getLocales().map((locale) => locale.languageTag);
  } catch {
    return [];
  }
}

/** Activate one of the supported app locales on the shared Lingui singleton. */
export function activateNativeLocale(locale: AppLocale): void {
  i18n.load(locale, CATALOGS[locale]);
  i18n.activate(locale);
}

/**
 * Negotiate the effective locale from a stored override and the device's
 * preferred languages. A non-null `storedLocale` always wins; otherwise the
 * device tags are matched, falling back to `DEFAULT_LOCALE`.
 */
export function detectNativeLocale(storedLocale: string | null): AppLocale {
  return detectPreferredLocale({
    storedLocale,
    navigatorLocales: deviceLocaleTags(),
  });
}

export { DEFAULT_LOCALE, i18n, tr, useTr };
export type { AppLocale };
