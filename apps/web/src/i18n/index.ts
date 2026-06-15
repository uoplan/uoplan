/**
 * Web i18n adapter.
 *
 * Re-exports the portable i18n core (`@uoplan/i18n`) so existing app imports of
 * `../i18n` keep working unchanged, and adds the web-specific bootstrap:
 * catalog loading (the compiled `@uoplan/i18n` catalogs) + locale
 * detection/persistence (`localStorage` / `navigator`).
 */
import { detect, fromNavigator, fromStorage } from "@lingui/detect-locale";

import { DEFAULT_LOCALE, detectPreferredLocale, i18n } from "@uoplan/i18n";
import type { AppLocale } from "@uoplan/i18n";

export * from "@uoplan/i18n";

const LOCALE_STORAGE_KEY = "uoplan.lang";

function readStoredLocale(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LOCALE_STORAGE_KEY);
}

function readNavigatorLocales(): string[] {
  if (typeof window === "undefined") return [];

  const detected = detect(fromStorage(LOCALE_STORAGE_KEY), fromNavigator(), () => DEFAULT_LOCALE);

  const browserLocales = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language];

  return [detected, ...browserLocales].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

async function loadCatalog(locale: AppLocale) {
  switch (locale) {
    case "fr-CA": {
      return import("@uoplan/i18n/catalogs/fr-CA");
    }
    case "en":
    default: {
      return import("@uoplan/i18n/catalogs/en");
    }
  }
}

export async function dynamicActivate(locale: AppLocale) {
  const { messages } = await loadCatalog(locale);
  i18n.load(locale, messages);
  i18n.activate(locale);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export async function initializeI18n() {
  const locale = detectPreferredLocale({
    storedLocale: readStoredLocale(),
    navigatorLocales: readNavigatorLocales(),
  });
  await dynamicActivate(locale);
}
