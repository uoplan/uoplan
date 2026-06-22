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

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Catalog } from "./i18n/catalog.ts";
import { isUntranslated, loadAllCatalogs, LOCALES, relPath, repoRoot } from "./i18n/catalog.ts";
import { DYNAMIC_TR_IDS } from "./i18n/dynamic-keys.ts";
import { collectTrUsages } from "./i18n/tr-ids.ts";

function fail(lines: string[]): void {
  console.error(lines.join("\n"));
}

/** Absolute path to a locale's committed compiled catalog. */
function compiledCatalogPath(locale: string): string {
  return resolve(repoRoot, "packages/i18n/src/locales", locale, "messages.ts");
}

/**
 * Guard against compiled-catalog drift.
 *
 * The runtime catalogs (`packages/i18n/src/locales/{locale}/messages.ts`) are
 * committed build artifacts compiled from the hand-maintained `.po` files (so a
 * fresh checkout — e.g. Metro — has them without running `pnpm generate`). They
 * can silently drift if a `.po` is edited without recompiling. To close that
 * hole in BOTH CI and pre-commit (this check runs in both), recompile from the
 * source `.po` and verify the committed `.ts` is byte-identical. The check is
 * side-effect-free: any file the recompile rewrites is restored to its committed
 * content before returning, so a stale catalog is reported, not silently fixed.
 *
 * @returns repo-relative paths of stale compiled catalogs (empty = fresh)
 */
function collectStaleCompiledCatalogs(): string[] {
  const targets = LOCALES.map((locale) => compiledCatalogPath(locale));
  const before = targets.map((p) => (existsSync(p) ? readFileSync(p, "utf8") : null));

  try {
    execFileSync("pnpm", ["--filter", "@uoplan/i18n", "run", "i18n:compile"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
  } catch (err) {
    throw new Error(
      `Failed to recompile message catalogs for the drift check: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const stale: string[] = [];
  for (const [i, p] of targets.entries()) {
    const after = existsSync(p) ? readFileSync(p, "utf8") : null;
    if (after === before[i]) continue;
    stale.push(relPath(p));
    // Restore the committed content so the check leaves no working-tree changes.
    if (before[i] === null) {
      // The committed file was missing; the recompile created one — leave it
      // reported as stale (a missing compiled catalog is drift too).
    } else {
      writeFileSync(p, before[i]);
    }
  }
  return stale;
}

function main(): void {
  const catalogs = loadAllCatalogs();
  const byLocale = new Map<string, Catalog>(catalogs.map((c) => [c.locale, c]));
  // Static tr() ids resolved from source, plus dynamic ids that the AST scanner cannot resolve.
  const usages = [
    ...collectTrUsages(),
    ...DYNAMIC_TR_IDS.map((id) => ({
      id,
      file: "scripts/i18n/dynamic-keys.ts",
      line: 0,
      column: 0,
    })),
  ];

  const problems: string[][] = [];

  // 1. missing — every resolved tr() id must exist in every locale.
  const missing = new Map<string, { locales: string[]; at: string }>();
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
  const allKeys = new Set<string>();
  for (const c of catalogs) for (const id of c.entries.keys()) allKeys.add(id);
  const parityGaps = new Map<string, string[]>();
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
  const emptyLines: string[] = [];
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
  const obsoleteLines: string[] = [];
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

  // 5. compiled-catalog drift — the committed runtime catalogs must match a fresh
  //    compile of the `.po` source (see collectStaleCompiledCatalogs).
  const staleCompiled = collectStaleCompiledCatalogs();
  if (staleCompiled.length > 0) {
    problems.push([
      `✖ ${staleCompiled.length} compiled catalog(s) stale — run \`pnpm i18n:compile\` (or \`pnpm generate\`) and commit:`,
      ...staleCompiled.map((p) => `    ${p}`),
    ]);
  }

  if (problems.length > 0) {
    fail([
      "Translation check failed.\n",
      ...problems.map((b) => b.join("\n")),
      "\nAdd the missing msgid/msgstr entries to packages/i18n/src/locales/{en,fr-CA}/messages.po.",
    ]);
    process.exit(1);
  }

  const usedCount = new Set(usages.map((u) => u.id)).size;
  console.log(
    `✓ i18n OK — ${usedCount} resolvable tr() ids, ${allKeys.size} catalog keys, locales: ${LOCALES.join(", ")}.`,
  );
}

main();
