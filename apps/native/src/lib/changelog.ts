/**
 * Pure parser for the repo's conventional-changelog `CHANGELOG.md`. The web app
 * renders the changelog as compiled HTML (a Vite virtual module); on native we
 * instead parse the same source into a structured model so it can be rendered as
 * native release cards with grouped, chip-style commit lists (no HTML/WebView).
 */

export interface ChangelogEntry {
  /** Commit subject (scope prefix stripped into {@link scope}). */
  text: string;
  /** Conventional-commit scope, e.g. "web" from `**web:** ...`. */
  scope?: string;
  /** Short commit hash, when present. */
  hash?: string;
}

export interface ChangelogSection {
  /** Section heading, e.g. "Features", "Bug Fixes". */
  title: string;
  entries: ChangelogEntry[];
}

export interface ChangelogRelease {
  /** Version string, e.g. "1.0.0-beta.33". */
  version: string;
  /** Release date as written (YYYY-MM-DD), when present. */
  date?: string;
  sections: ChangelogSection[];
}

// `## [1.0.0-beta.33](compare-url) (2026-06-13)` or `## 1.0.0 (2026-06-13)`.
const RELEASE_RE =
  /^##\s+(?:\[([^\]]+)\]\([^)]*\)|([^\s(]+))\s*(?:\(([0-9]{4}-[0-9]{2}-[0-9]{2})\))?/;
// `### Features`
const SECTION_RE = /^###\s+(.+?)\s*$/;
// `* message ([abc1234](url))` — optionally `**scope:** message`.
const ENTRY_RE = /^[*-]\s+(.+?)\s*$/;
const HASH_RE = /\(\[([0-9a-f]{6,})\]\([^)]*\)\)\s*$/i;
const SCOPE_RE = /^\*\*([^:*]+):\*\*\s*/;

/** Parse conventional-changelog markdown into a list of releases. */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | undefined;
  let section: ChangelogSection | undefined;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();

    const releaseMatch = RELEASE_RE.exec(line);
    if (releaseMatch) {
      release = {
        version: releaseMatch[1] ?? releaseMatch[2] ?? "",
        date: releaseMatch[3],
        sections: [],
      };
      releases.push(release);
      section = undefined;
      continue;
    }

    if (!release) continue;

    const sectionMatch = SECTION_RE.exec(line);
    if (sectionMatch) {
      section = { title: sectionMatch[1], entries: [] };
      release.sections.push(section);
      continue;
    }

    const entryMatch = ENTRY_RE.exec(line);
    if (entryMatch) {
      if (!section) {
        section = { title: "Changes", entries: [] };
        release.sections.push(section);
      }
      let text = entryMatch[1];

      const hashMatch = HASH_RE.exec(text);
      const hash = hashMatch?.[1];
      if (hashMatch) text = text.slice(0, hashMatch.index).trimEnd();

      const scopeMatch = SCOPE_RE.exec(text);
      const scope = scopeMatch?.[1];
      if (scopeMatch) text = text.slice(scopeMatch[0].length);

      section.entries.push({ text, scope, hash });
    }
  }

  // Drop empty sections / releases so the UI never renders blank cards.
  for (const r of releases) {
    r.sections = r.sections.filter((s) => s.entries.length > 0);
  }
  return releases.filter((r) => r.version && r.sections.length > 0);
}
