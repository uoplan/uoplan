/**
 * oxlint JS plugin: inline editor/CLI diagnostics for missing translations.
 *
 * Reports `tr("literal.id")` calls whose id is absent from a Lingui catalog.
 * This is a convenience layer for fast feedback in the editor — the
 * authoritative enforcement (including catalog parity and empty msgstr, which
 * have no source node to attach to) lives in `scripts/check-i18n.ts`.
 *
 * oxlint JS plugins use an ESLint v9-compatible API and are currently alpha.
 * The plugin/AST types are not exported from `oxlint/plugins-dev`, so the
 * minimal node shapes this rule touches are declared locally.
 */

import { loadCatalog, LOCALES } from "./catalog.ts";
import { staticEstreeIds } from "./static-ids.ts";
import type { EstreeNode } from "./static-ids.ts";

interface ReportDescriptor {
  node: unknown;
  messageId: string;
  data?: Record<string, string>;
}

interface RuleContext {
  report(descriptor: ReportDescriptor): void;
}

interface ImportSpecifierNode {
  type: string;
  imported?: { name: string };
  local: { name: string };
}

interface ImportDeclarationNode {
  source: { value: unknown };
  specifiers: ImportSpecifierNode[];
}

interface CallExpressionNode {
  callee: { type: string; name?: string };
  arguments: EstreeNode[];
}

interface RuleVisitor {
  ImportDeclaration(node: ImportDeclarationNode): void;
  CallExpression(node: CallExpressionNode): void;
}

const plugin = {
  meta: { name: "i18n-tr" },
  rules: {
    "tr-key-exists": {
      meta: {
        type: "problem",
        docs: { description: "Ensure tr() ids exist in all locale catalogs." },
        schema: [],
        messages: {
          missing: 'Translation id "{{id}}" is missing from catalog(s): {{locales}}.',
        },
      },
      create(context: RuleContext): RuleVisitor {
        let trName: string | null = null;
        return {
          ImportDeclaration(node) {
            const spec = node.source.value;
            if (typeof spec !== "string" || !/(^|\/)i18n$/.test(spec)) return;
            for (const s of node.specifiers) {
              if (s.type === "ImportSpecifier" && s.imported?.name === "tr") {
                trName = s.local.name;
              }
            }
          },
          CallExpression(node) {
            if (!trName || node.callee.type !== "Identifier" || node.callee.name !== trName) return;
            const ids = staticEstreeIds(node.arguments[0]);
            for (const id of ids) {
              const absent = LOCALES.filter((loc) => !loadCatalog(loc).entries.has(id));
              if (absent.length > 0) {
                context.report({
                  node: node.arguments[0],
                  messageId: "missing",
                  data: { id, locales: absent.join(", ") },
                });
              }
            }
          },
        };
      },
    },
  },
};

export default plugin;
