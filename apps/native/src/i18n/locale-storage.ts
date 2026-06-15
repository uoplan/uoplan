import type { File as FileType, Paths as PathsType } from "expo-file-system";

import { type AppLocale, APP_LOCALES } from "@uoplan/i18n";

/** File (under the persistent document dir) the locale override lives in. */
export const LOCALE_FILE = "uoplan-locale.json";

/** Persisted shape: an explicit app locale, or `null` to follow the system. */
interface StoredLocaleOverride {
  locale: AppLocale | null;
}

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (APP_LOCALES as readonly string[]).includes(value);
}

/**
 * Parse persisted override JSON into an `AppLocale` or `null` (follow system).
 * Tolerates any malformed shape — a corrupt file degrades to "follow system"
 * (`null`) rather than throwing.
 */
export function parseLocaleOverride(text: string): AppLocale | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { locale } = raw as { locale?: unknown };
  return isAppLocale(locale) ? locale : null;
}

/** Serialize a locale override (or `null` for "follow system") to JSON. */
export function serializeLocaleOverride(locale: AppLocale | null): string {
  const payload: StoredLocaleOverride = { locale };
  return JSON.stringify(payload);
}

// `expo-file-system` is required lazily (not statically imported) so this store
// stays out of the jest render-test module graph — the same pattern used by
// `data/basket-storage.ts`. apps/native is excluded from oxlint, so require() is fine.
function fileSystem(): { File: typeof FileType; Paths: typeof PathsType } {
  return require("expo-file-system");
}

/** Load the persisted override from disk (best-effort; `null` on any failure). */
export async function readLocaleOverride(): Promise<AppLocale | null> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, LOCALE_FILE);
    if (!file.exists) return null;
    return parseLocaleOverride(await file.text());
  } catch {
    return null;
  }
}

/** Persist the override (or `null` for "follow system") to disk (best-effort). */
export async function writeLocaleOverride(locale: AppLocale | null): Promise<void> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, LOCALE_FILE);
    file.write(serializeLocaleOverride(locale));
  } catch {
    // best-effort: a failed write must not break the UI.
  }
}
