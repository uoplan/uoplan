// @ts-check
/**
 * Catalog sync for the hand-maintained, id-based Lingui workflow.
 *
 * `lingui extract` is unusable here: the app localises through a custom
 * `tr("literal.id")` helper with no Lingui macros, so an extract run finds zero
 * messages and obsoletes the entire catalog. This script is the replacement.
 *
 * It computes the full set of used translation ids from source — statically
 * resolvable `tr()` calls (via the TS AST scan in `i18n/tr-ids.mjs`) plus the
 * dynamic-key registry (`i18n/dynamic-keys.mjs`) — and reconciles every locale
 * catalog against it:
 *
 *   - adds missing ids with an empty `msgstr` and `#:` source references, and
 *   - with `--prune`, deletes catalog ids that are no longer used.
 *
 * It manages *keys*, not translations: newly added ids start empty, so
 * `pnpm check:i18n` will then fail on empty `msgstr` until a human fills them in.
 * Entries are kept sorted by id for stable diffs. Existing entries (including
 * ICU plurals and comments) are preserved untouched.
 *
 * Usage:
 *   node scripts/i18n-sync.mjs            # apply additions
 *   node scripts/i18n-sync.mjs --prune    # apply additions and delete unused ids
 *   node scripts/i18n-sync.mjs --check    # report drift, write nothing, exit 1 if any
 *   node scripts/i18n-sync.mjs --check --prune
 */

import { readFileSync, writeFileSync } from "node:fs";
import PO from "pofile";
import { LOCALES, catalogPath, relPath } from "./i18n/catalog.mjs";
import { DYNAMIC_TR_IDS } from "./i18n/dynamic-keys.mjs";
import { collectTrUsages } from "./i18n/tr-ids.mjs";

const MAX_REFS = 8;

/**
 * The full set of used translation ids, with source references for each.
 * @returns {Map<string, string[]>} id -> sorted, de-duplicated `file:line` refs
 */
function collectUsedIds() {
  /** @type {Map<string, Set<string>>} */
  const refs = new Map();
  const add = (/** @type {string} */ id, /** @type {string} */ ref) => {
    const set = refs.get(id) ?? new Set();
    set.add(ref);
    refs.set(id, set);
  };

  for (const u of collectTrUsages()) add(u.id, `${u.file}:${u.line}`);
  for (const id of DYNAMIC_TR_IDS) add(id, "scripts/i18n/dynamic-keys.mjs");

  return new Map(
    [...refs].map(([id, set]) => [
      id,
      [...set].sort((a, b) => a.localeCompare(b)).slice(0, MAX_REFS),
    ]),
  );
}

/**
 * @param {string} locale
 * @param {Map<string, string[]>} used
 * @param {boolean} prune
 */
function reconcileLocale(locale, used, prune) {
  const path = catalogPath(locale);
  const po = PO.parse(readFileSync(path, "utf8"));

  const present = new Set(po.items.filter((i) => i.msgid && !i.obsolete).map((i) => i.msgid));

  /** @type {string[]} */
  const added = [];
  for (const [id, refs] of used) {
    if (present.has(id)) continue;
    const item = new PO.Item();
    item.msgid = id;
    item.msgstr = [""];
    item.references = refs;
    po.items.push(item);
    added.push(id);
  }

  /** @type {string[]} */
  const removed = [];
  if (prune) {
    po.items = po.items.filter((item) => {
      if (!item.msgid || item.obsolete) return true;
      if (used.has(item.msgid)) return true;
      removed.push(item.msgid);
      return false;
    });
  }

  // Re-obsoleted/orphaned entries are never expected; keep entries sorted by id
  // for stable, reviewable diffs.
  po.items.sort((a, b) => a.msgid.localeCompare(b.msgid));

  return { path, po, added: added.sort(), removed: removed.sort() };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");
  const prune = args.has("--prune");

  const used = collectUsedIds();
  let drift = 0;

  for (const locale of LOCALES) {
    const { path, po, added, removed } = reconcileLocale(locale, used, prune);
    if (added.length === 0 && removed.length === 0) continue;
    drift += added.length + removed.length;

    const verb = check ? "would" : "did";
    console.log(`\n[${locale}] ${relPath(path)}`);
    if (added.length > 0) {
      console.log(`  + ${verb} add ${added.length} id(s):`);
      for (const id of added) console.log(`      ${id}`);
    }
    if (removed.length > 0) {
      console.log(`  - ${verb} remove ${removed.length} unused id(s):`);
      for (const id of removed) console.log(`      ${id}`);
    }
    if (!check) writeFileSync(path, po.toString());
  }

  if (drift === 0) {
    console.log("✓ i18n catalogs already in sync with source.");
    return;
  }

  if (check) {
    console.error(
      `\n✖ Catalogs are out of sync (${drift} change(s) needed). Run \`pnpm i18n:sync${prune ? " --prune" : ""}\`.`,
    );
    process.exit(1);
  }

  console.log(
    `\n✓ Synced ${drift} change(s). Fill in empty msgstr for added ids, then run \`pnpm check:i18n\`.`,
  );
}

main();
