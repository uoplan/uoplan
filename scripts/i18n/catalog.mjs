// @ts-check
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

/** @param {string} locale */
function catalogPath(locale) {
  return resolve(repoRoot, "apps/web/src/locales", locale, "messages.po");
}

/**
 * @typedef {object} CatalogEntry
 * @property {string} id
 * @property {string[]} msgstr
 * @property {boolean} fuzzy
 * @property {boolean} obsolete
 */

/**
 * @typedef {object} Catalog
 * @property {string} locale
 * @property {string} path
 * @property {Map<string, CatalogEntry>} entries  Keyed by msgid (header excluded).
 */

/** @type {Map<string, Catalog>} */
const cache = new Map();

/**
 * Parse a locale catalog, caching the result for the lifetime of the process.
 * @param {string} locale
 * @returns {Catalog}
 */
export function loadCatalog(locale) {
  const cached = cache.get(locale);
  if (cached) return cached;

  const path = catalogPath(locale);
  const po = PO.parse(readFileSync(path, "utf8"));

  /** @type {Map<string, CatalogEntry>} */
  const entries = new Map();
  for (const item of po.items) {
    // The empty-id header is not represented as an item by pofile, but guard anyway.
    if (!item.msgid) continue;
    entries.set(item.msgid, {
      id: item.msgid,
      msgstr: item.msgstr ?? [],
      fuzzy: Boolean(item.flags && item.flags.fuzzy),
      obsolete: Boolean(item.obsolete),
    });
  }

  const catalog = { locale, path, entries };
  cache.set(locale, catalog);
  return catalog;
}

/**
 * Load every enforced locale catalog.
 * @returns {Catalog[]}
 */
export function loadAllCatalogs() {
  return LOCALES.map(loadCatalog);
}

/**
 * True when an entry has no usable translation (every msgstr form is empty).
 * @param {CatalogEntry} entry
 */
export function isUntranslated(entry) {
  return entry.msgstr.length === 0 || entry.msgstr.every((s) => s.trim() === "");
}

/** Repo-relative path for tidy diagnostics. @param {string} absPath */
export function relPath(absPath) {
  return absPath.startsWith(repoRoot + "/") ? absPath.slice(repoRoot.length + 1) : absPath;
}

export { repoRoot };
