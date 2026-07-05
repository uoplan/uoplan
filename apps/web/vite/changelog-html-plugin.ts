import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:changelog-html";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

type ChangelogHtmlCacheEntry = {
  mtimeMs: number;
  size: number;
  moduleCode: string;
};

const renderedChangelogCache = new Map<string, ChangelogHtmlCacheEntry>();

function changelogMarkdownPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // apps/web/vite → monorepo root (CHANGELOG.md)
  return path.join(here, "..", "..", "..", "CHANGELOG.md");
}

function createMarkdownRenderer(): MarkdownIt {
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
  return md;
}

const markdownRenderer = createMarkdownRenderer();

function loadRenderedChangelogModule(mdPath: string): string {
  const cacheKey = path.resolve(mdPath);
  const stats = fs.statSync(mdPath);
  const cached = renderedChangelogCache.get(cacheKey);

  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.moduleCode;
  }

  let source = fs.readFileSync(mdPath, "utf8");
  source = source.replace(/^#\s*Changelog\s*\n+/i, "");

  const html = markdownRenderer.render(source);
  const moduleCode = `export default ${JSON.stringify(html)};`;

  renderedChangelogCache.set(cacheKey, {
    mtimeMs: stats.mtimeMs,
    moduleCode,
    size: stats.size,
  });

  return moduleCode;
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
      this.addWatchFile(mdPath);

      return loadRenderedChangelogModule(mdPath);
    },
  };
}
