// @ts-check
/**
 * Translation completeness checker for apps/web.
 *
 * Strings are localised through a custom `tr("literal.id")` helper and the
 * Lingui PO catalogs are maintained by hand, so `lingui extract` cannot catch
 * gaps. This is the authoritative check (run in CI and pre-commit):
 *
 *   1. missing   — a statically-resolvable tr() id absent from a catalog.
 *   2. parity    — a key present in one locale but missing in another.
 *   3. empty     — an entry with no usable translation (empty msgstr).
 *
 * Dynamic tr() ids (template literals, variables) cannot be resolved and are
 * not checked here.
 *
 * Run: `pnpm check:i18n`. Exits non-zero when any problem is found.
 */

import { LOCALES, isUntranslated, loadAllCatalogs, relPath } from "./i18n/catalog.mjs";
import { collectTrUsages } from "./i18n/tr-ids.mjs";
import { DYNAMIC_TR_IDS } from "./i18n/dynamic-keys.mjs";

/** @param {string} msg */
function fail(lines) {
  console.error(lines.join("\n"));
}

function main() {
  const catalogs = loadAllCatalogs();
  const byLocale = new Map(catalogs.map((c) => [c.locale, c]));
  // Static tr() ids resolved from source, plus dynamic ids that the AST scanner cannot resolve.
  const usages = [
    ...collectTrUsages(),
    ...DYNAMIC_TR_IDS.map((id) => ({
      id,
      file: "scripts/i18n/dynamic-keys.mjs",
      line: 0,
      column: 0,
    })),
  ];

  /** @type {string[][]} grouped problem blocks */
  const problems = [];

  // 1. missing — every resolved tr() id must exist in every locale.
  /** @type {Map<string, { locales: string[], at: string }>} */
  const missing = new Map();
  for (const u of usages) {
    const absent = LOCALES.filter((loc) => !byLocale.get(loc)?.entries.has(u.id));
    if (absent.length === 0) continue;
    const existing = missing.get(u.id);
    if (existing) {
      // keep the broadest set of missing locales; first location wins
      for (const loc of absent) if (!existing.locales.includes(loc)) existing.locales.push(loc);
    } else {
      missing.set(u.id, { locales: absent, at: `${u.file}:${u.line}:${u.column}` });
    }
  }
  if (missing.size > 0) {
    const block = [`✖ ${missing.size} tr() id(s) missing from catalog(s):`];
    for (const [id, info] of [...missing].sort((a, b) => a[0].localeCompare(b[0]))) {
      block.push(`    "${id}" — missing from: ${info.locales.join(", ")}  (used at ${info.at})`);
    }
    problems.push(block);
  }

  // 2. parity — union of all keys must exist in every locale.
  /** @type {Set<string>} */
  const allKeys = new Set();
  for (const c of catalogs) for (const id of c.entries.keys()) allKeys.add(id);
  /** @type {Map<string, string[]>} id -> locales missing it */
  const parityGaps = new Map();
  for (const id of allKeys) {
    const absent = LOCALES.filter((loc) => !byLocale.get(loc)?.entries.has(id));
    if (absent.length > 0 && absent.length < LOCALES.length) parityGaps.set(id, absent);
  }
  if (parityGaps.size > 0) {
    const block = [`✖ ${parityGaps.size} catalog key(s) not present in all locales:`];
    for (const [id, locs] of [...parityGaps].sort((a, b) => a[0].localeCompare(b[0]))) {
      block.push(`    "${id}" — missing from: ${locs.join(", ")}`);
    }
    problems.push(block);
  }

  // 3. empty — entries with no usable translation.
  /** @type {string[]} */
  const emptyLines = [];
  for (const c of catalogs) {
    for (const entry of c.entries.values()) {
      if (isUntranslated(entry)) {
        emptyLines.push(`    [${c.locale}] "${entry.id}"  (${relPath(c.path)})`);
      }
    }
  }
  if (emptyLines.length > 0) {
    problems.push([`✖ ${emptyLines.length} entry/entries with empty translation:`, ...emptyLines]);
  }

  // 4. obsolete — `#~` entries indicate catalog corruption. This hand-maintained, id-based
  //    workflow never uses `lingui extract`, so obsolete markers only appear when a stray CLI run
  //    comments out the catalog (entries excluded from runtime would silently render raw ids).
  /** @type {string[]} */
  const obsoleteLines = [];
  for (const c of catalogs) {
    for (const id of c.obsoleteIds) {
      obsoleteLines.push(`    [${c.locale}] "${id}"  (${relPath(c.path)})`);
    }
  }
  if (obsoleteLines.length > 0) {
    problems.push([
      `✖ ${obsoleteLines.length} obsolete (#~) catalog entry/entries — reactivate or delete them:`,
      ...obsoleteLines,
    ]);
  }

  if (problems.length > 0) {
    fail([
      "Translation check failed.\n",
      ...problems.map((b) => b.join("\n")),
      "\nAdd the missing msgid/msgstr entries to apps/web/src/locales/{en,fr-CA}/messages.po.",
    ]);
    process.exit(1);
  }

  const usedCount = new Set(usages.map((u) => u.id)).size;
  console.log(
    `✓ i18n OK — ${usedCount} resolvable tr() ids, ${allKeys.size} catalog keys, locales: ${LOCALES.join(", ")}.`,
  );
}

main();
