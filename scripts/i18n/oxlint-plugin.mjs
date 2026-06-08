// @ts-check
/**
 * oxlint JS plugin: inline editor/CLI diagnostics for missing translations.
 *
 * Reports `tr("literal.id")` calls whose id is absent from a Lingui catalog.
 * This is a convenience layer for fast feedback in the editor — the
 * authoritative enforcement (including catalog parity and empty msgstr, which
 * have no source node to attach to) lives in `scripts/check-i18n.mjs`.
 *
 * oxlint JS plugins use an ESLint v9-compatible API and are currently alpha.
 */

import { LOCALES, loadCatalog } from "./catalog.mjs";
import { staticEstreeIds } from "./static-ids.mjs";

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
      create(context) {
        let trName = null;
        return {
          ImportDeclaration(node) {
            const spec = node.source.value;
            if (typeof spec !== "string" || !/(^|\/)i18n$/.test(spec)) return;
            for (const s of node.specifiers) {
              if (s.type === "ImportSpecifier" && s.imported.name === "tr") {
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
