import { i18n } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { detect, fromNavigator, fromStorage } from "@lingui/detect-locale";

const LOCALE_STORAGE_KEY = "uoplan.lang";
const APP_LOCALES = ["en", "fr-CA"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

const DEFAULT_LOCALE: AppLocale = "en";

function toSupportedLocale(raw: string | null | undefined): AppLocale | null {
  if (!raw) return null;
  const locale = raw.trim().toLowerCase();
  if (locale === "fr" || locale.startsWith("fr-")) return "fr-CA";
  if (locale === "en" || locale.startsWith("en-")) return "en";
  return null;
}

export function normalizeLocale(raw: string | null | undefined): AppLocale {
  return toSupportedLocale(raw) ?? DEFAULT_LOCALE;
}

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
      return import("../locales/fr-CA/messages.po");
    }
    case "en":
    default: {
      return import("../locales/en/messages.po");
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

export { i18n };
