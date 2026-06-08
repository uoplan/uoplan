// @ts-check
/**
 * AST scan of `apps/web/src` for `tr(...)` call sites.
 *
 * The app localises strings through a custom `tr(id, values?)` helper that
 * takes string-literal ids (no Lingui macros), so this collects every
 * statically-resolvable id together with its source location. Dynamic ids
 * (template literals with expressions, variables) cannot be resolved and are
 * intentionally skipped.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { repoRoot } from "./catalog.mjs";
import { staticTsIds } from "./static-ids.mjs";

const WEB_SRC = resolve(repoRoot, "apps/web/src");
const I18N_MODULE = resolve(WEB_SRC, "i18n"); // resolves to i18n/index.ts

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
 * Resolve the local identifier bound to the i18n `tr` export in a file, if any.
 * Returns the local name (usually "tr") or null when the file does not import it.
 * @param {ts.SourceFile} sf
 * @param {string} filePath
 */
function findTrBinding(sf, filePath) {
  let local = null;
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    if (!spec.startsWith(".")) continue;
    const resolved = resolve(dirname(filePath), spec);
    if (resolved !== I18N_MODULE) continue;

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
 * Scan apps/web/src and return all statically-resolvable tr() ids with locations.
 * @returns {TrUsage[]}
 */
export function collectTrUsages() {
  /** @type {TrUsage[]} */
  const usages = [];

  for (const filePath of collectSourceFiles(WEB_SRC)) {
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

  return usages;
}
