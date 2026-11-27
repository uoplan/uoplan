import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseImportantDatesPages } from "./parse.ts";
import { extractTermPageLinks } from "./parseExtract.ts";
import type { TermPageInput } from "./parseTypes.ts";

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const EN_URL = "https://www.uottawa.ca/study/important-academic-dates-deadlines";
const FR_URL = "https://www.uottawa.ca/etudes/dates-importantes-echeances-scolaires";

const TERMS = ["fall-2026", "spring-summer-2027"] as const;

async function readFixture(name: string): Promise<string> {
  return fs.readFile(path.join(FIXTURE_DIR, name), "utf-8");
}

async function loadPages(
  overrides: Partial<Record<string, (html: string) => string>> = {},
): Promise<{ enPages: TermPageInput[]; frPages: TermPageInput[] }> {
  const load = async (locale: "en" | "fr", baseUrl: string) =>
    Promise.all(
      TERMS.map(async (term) => {
        const name = `${term}.${locale}.html`;
        const html = await readFixture(name);
        return {
          sourceId: term,
          sourceUrl: `${baseUrl}/${term}`,
          html: overrides[name]?.(html) ?? html,
        };
      }),
    );
  return { enPages: await load("en", EN_URL), frPages: await load("fr", FR_URL) };
}

function parse(pages: { enPages: TermPageInput[]; frPages: TermPageInput[] }) {
  return parseImportantDatesPages({ ...pages, enSourceUrl: EN_URL, frSourceUrl: FR_URL });
}

function replaceOnce(input: string, search: string, replacement: string): string {
  const output = input.replace(search, replacement);
  if (output === input) {
    throw new Error(`Expected fixture fragment not found: ${search}`);
  }
  return output;
}

describe("extractTermPageLinks", () => {
  it("finds per-term pages on the index and skips past-terms / non-term links", async () => {
    const en = extractTermPageLinks(await readFixture("index.en.html"), EN_URL);
    expect(en.map((url) => url.split("/").pop())).toEqual(
      expect.arrayContaining(["fall-2026", "winter-2027", "spring-summer-2027"]),
    );
    expect(en.some((url) => url.endsWith("past-terms"))).toBe(false);

    const fr = extractTermPageLinks(await readFixture("index.fr.html"), FR_URL);
    expect(fr.map((url) => url.split("/").pop())).toEqual(
      expect.arrayContaining(["automne-2026", "hiver-2027", "printemps-ete-2027"]),
    );
    expect(fr.some((url) => url.endsWith("trimestres-passes"))).toBe(false);
  });
});

describe("parseImportantDatesPages", () => {
  it("parses per-term pages into symmetric locale datasets", async () => {
    const parsed = parse(await loadPages());

    expect(parsed.en.terms.map((t) => t.sourceId)).toEqual(["fall-2026", "spring-summer-2027"]);
    expect(parsed.en.terms.map((t) => t.termId)).toEqual(["2269", "2275"]);
    expect(parsed.en.terms.map((t) => t.label)).toEqual(["Fall 2026", "Spring-Summer 2027"]);
    expect(parsed.fr.terms.map((t) => t.label)).toEqual(["Automne 2026", "Printemps-été 2027"]);
    expect(parsed.en.terms.every((t) => t.sourcePublished === "true")).toBe(true);

    const shape = (data: typeof parsed.en) =>
      data.terms.map((t) => ({
        sourceId: t.sourceId,
        sessions: t.sessions,
        sections: t.sections.map((s) => ({
          id: s.id,
          category: s.category,
          groups: s.groups.map((g) => ({ id: g.id, items: g.items.map((i) => i.id) })),
        })),
      }));
    expect(shape(parsed.fr)).toEqual(shape(parsed.en));

    const spring = parsed.en.terms[1];
    expect(spring.sessions?.map((s) => s.code)).toEqual(expect.arrayContaining(["A", "B", "C"]));
  });

  it("treats 'Revised - <date>' cells as the revised date", async () => {
    const parsed = parse(await loadPages());
    const items = parsed.en.terms[0].sections.flatMap((s) => s.groups.flatMap((g) => g.items));
    const revised = items.filter((item) => item.dateText.startsWith("November 27"));
    expect(revised.length).toBeGreaterThan(0);
    expect(revised.every((item) => item.interval !== undefined)).toBe(true);
    expect(items.some((item) => /^revised/i.test(item.dateText))).toBe(false);
  });

  it("rejects French structural drift with contextual errors", async () => {
    const pages = await loadPages({
      "fall-2026.fr.html": (html) =>
        replaceOnce(html, "<td>Date révisée - 27 novembre 2026</td>", ""),
    });

    expect(() => parse(pages)).toThrow(/fall-2026/);
    expect(() => parse(pages)).toThrow(/etudes\/dates-importantes-echeances-scolaires/i);
  });

  it("rejects unsupported schedule-change prose instead of silently downgrading it", async () => {
    const pages = await loadPages({
      "spring-summer-2027.en.html": (html) =>
        replaceOnce(
          html,
          "They will be held on Saturday, May 29, when the usual Monday course schedule will apply.",
          "Please check with your professor for details.",
        ),
    });

    expect(() => parse(pages)).toThrow(/unsupported current schedule-change/i);
    expect(() => parse(pages)).toThrow(/spring-summer-2027/);
  });
});
