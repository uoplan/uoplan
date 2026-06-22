/**
 * Shared i18n catalog helpers for the translation lint.
 *
 * Loads the hand-maintained Lingui PO catalogs and exposes the data the
 * checker script and the oxlint plugin both need. Kept dependency-light and
 * side-effect-free apart from a module-scope parse cache.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PO from "pofile";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Locales to enforce, in `sourceLocale` first order (mirrors lingui.config.ts). */
export const LOCALES = ["en", "fr-CA"];

export function catalogPath(locale: string): string {
  return resolve(repoRoot, "packages/i18n/src/locales", locale, "messages.po");
}

export interface CatalogEntry {
  id: string;
  msgstr: string[];
  fuzzy: boolean;
}

export interface Catalog {
  locale: string;
  path: string;
  /**
   * Active entries keyed by msgid (header and obsolete `#~` entries excluded).
   * Obsolete entries never satisfy key presence — a `tr()` id backed only by an
   * obsolete entry is reported missing, so a stray `lingui extract` that comments
   * out the catalog can no longer pass silently.
   */
  entries: Map<string, CatalogEntry>;
  /** msgids present only as obsolete (`#~`) entries. */
  obsoleteIds: Set<string>;
}

const cache = new Map<string, Catalog>();

/** Parse a locale catalog, caching the result for the lifetime of the process. */
export function loadCatalog(locale: string): Catalog {
  const cached = cache.get(locale);
  if (cached) return cached;

  const path = catalogPath(locale);
  const po = PO.parse(readFileSync(path, "utf8"));

  const entries = new Map<string, CatalogEntry>();
  const obsoleteIds = new Set<string>();
  for (const item of po.items) {
    // The empty-id header is not represented as an item by pofile, but guard anyway.
    if (!item.msgid) continue;
    // Obsolete (`#~`) entries are excluded from runtime catalogs by Lingui, so they must not
    // satisfy presence/parity checks here either.
    if (item.obsolete) {
      obsoleteIds.add(item.msgid);
      continue;
    }
    entries.set(item.msgid, {
      id: item.msgid,
      msgstr: item.msgstr ?? [],
      fuzzy: Boolean(item.flags && item.flags.fuzzy),
    });
  }

  const catalog: Catalog = { locale, path, entries, obsoleteIds };
  cache.set(locale, catalog);
  return catalog;
}

/** Load every enforced locale catalog. */
export function loadAllCatalogs(): Catalog[] {
  return LOCALES.map(loadCatalog);
}

/** True when an entry has no usable translation (every msgstr form is empty). */
export function isUntranslated(entry: CatalogEntry): boolean {
  return entry.msgstr.length === 0 || entry.msgstr.every((s) => s.trim() === "");
}

/** Repo-relative path for tidy diagnostics. */
export function relPath(absPath: string): string {
  return absPath.startsWith(`${repoRoot}/`) ? absPath.slice(repoRoot.length + 1) : absPath;
}

export { repoRoot };
