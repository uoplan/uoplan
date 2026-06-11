import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:changelog-html";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

function changelogMarkdownPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // apps/web/vite → monorepo root (CHANGELOG.md)
  return path.join(here, "..", "..", "..", "CHANGELOG.md");
}

export function changelogHtmlPlugin(): Plugin {
  return {
    name: "changelog-html",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;

      const mdPath = changelogMarkdownPath();
      let source = fs.readFileSync(mdPath, "utf8");
      source = source.replace(/^#\s*Changelog\s*\n+/i, "");

      const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
      const defaultLinkOpen =
        md.renderer.rules.link_open ??
        ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token?.type === "link_open") {
          token.attrSet("target", "_blank");
          token.attrSet("rel", "noopener noreferrer");
        }
        return defaultLinkOpen(tokens, idx, options, env, self);
      };

      const html = md.render(source);
      return `export default ${JSON.stringify(html)};`;
    },
  };
}
