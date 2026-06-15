// @ts-check
/**
 * AST scan of `apps/web/src` and `apps/native/src` for `tr(...)` call sites.
 *
 * Both shells localise strings through a custom `tr(id, values?)` helper that
 * takes string-literal ids (no Lingui macros), so this collects every
 * statically-resolvable id together with its source location. Dynamic ids
 * (template literals with expressions, variables) cannot be resolved and are
 * intentionally skipped (they live in `dynamic-keys.mjs`).
 *
 * A file's `tr` binding is the one imported from an i18n module:
 *   - web:    a relative `./i18n` / `../i18n` import resolving to `apps/web/src/i18n`,
 *   - native: a relative i18n import resolving to `apps/native/src/i18n`, or the
 *             `@/i18n` path alias,
 *   - either: a direct `@uoplan/i18n` package import.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { repoRoot } from "./catalog.mjs";
import { staticTsIds } from "./static-ids.mjs";

/** Source roots scanned for `tr()` usages. */
const SOURCE_ROOTS = [resolve(repoRoot, "apps/web/src"), resolve(repoRoot, "apps/native/src")];

/** Absolute paths that an i18n import specifier may resolve to (per shell). */
const I18N_MODULE_DIRS = new Set(SOURCE_ROOTS.map((root) => resolve(root, "i18n")));

/** Test files are excluded from extraction (mirrors lingui.config.ts). */
function isTestFile(path) {
  return /\.(test|spec)\.tsx?$/.test(path) || /\/(?:tests|__tests__)\//.test(path);
}

/** @param {string} dir @returns {string[]} */
function collectSourceFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(full) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * True when an import specifier refers to a recognised i18n module: the direct
 * `@uoplan/i18n` package, the native `@/i18n` path alias, or a relative import
 * that resolves to one of the shells' `i18n` adapter directories.
 * @param {string} spec
 * @param {string} filePath
 */
function isI18nSpecifier(spec, filePath) {
  if (spec === "@uoplan/i18n") return true;
  if (spec === "@/i18n") return true;
  if (!spec.startsWith(".")) return false;
  return I18N_MODULE_DIRS.has(resolve(dirname(filePath), spec));
}

/**
 * Resolve the local identifier bound to the i18n `tr` export in a file, if any.
 * Returns the local name (usually "tr") or null when the file does not import it.
 * @param {ts.SourceFile} sf
 * @param {string} filePath
 */
function findTrBinding(sf, filePath) {
  let local = null;
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!isI18nSpecifier(stmt.moduleSpecifier.text, filePath)) continue;

    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        const imported = (el.propertyName ?? el.name).text;
        if (imported === "tr") local = el.name.text;
      }
    }
  }
  return local;
}

/**
 * @typedef {object} TrUsage
 * @property {string} id
 * @property {string} file   repo-relative path
 * @property {number} line   1-based
 * @property {number} column 1-based
 */

/**
 * Scan the source roots and return all statically-resolvable tr() ids with locations.
 * @returns {TrUsage[]}
 */
export function collectTrUsages() {
  /** @type {TrUsage[]} */
  const usages = [];

  for (const root of SOURCE_ROOTS) {
    let files;
    try {
      files = collectSourceFiles(root);
    } catch {
      // A shell's src may be absent in some checkouts; skip it gracefully.
      continue;
    }

    for (const filePath of files) {
      const text = readFileSync(filePath, "utf8");
      const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
      const trName = findTrBinding(sf, filePath);
      if (!trName) continue;

      const relFile = relative(repoRoot, filePath);

      /** @param {ts.Node} node */
      const visit = (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === trName &&
          node.arguments.length > 0
        ) {
          const { line, character } = sf.getLineAndCharacterOfPosition(
            node.arguments[0].getStart(sf),
          );
          for (const id of staticTsIds(ts, node.arguments[0])) {
            usages.push({ id, file: relFile, line: line + 1, column: character + 1 });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }

  return usages;
}
