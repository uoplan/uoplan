import * as cheerio from "cheerio";
import type { Program, ProgramRequirement } from "@uoplan/domain/dataTypes";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { processRequirements } from "../../../catalogue/requirements.ts";

type CheerioNode = NonNullable<Parameters<cheerio.CheerioAPI>[0]>;
type CheerioSelection = ReturnType<cheerio.CheerioAPI>;

export type ParseProgramPageStats = {
  totalRequirements: number;
  parsedRequirements: number;
};

export type ParseProgramPageResult = {
  programs: Program[];
  unparsed: string[];
  stats: ParseProgramPageStats;
};

type RequirementParse = {
  requirement: ProgramRequirement;
  parsed: boolean;
};

function normalizeText(text: string): string {
  return text.replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();
}

function parseCredits(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  return Number.isNaN(value) ? undefined : value;
}

function parseCodeCell(text: string): { code: string; credits?: number } | undefined {
  const normalized = normalizeText(text);
  const match = normalized.match(/^([A-Z]{3,4}\s*\d{4,5}[A-Z]?)(?:\s+\[(\d+(?:\.\d+)?)\])?/i);
  if (!match) return undefined;
  return {
    code: normalizeCourseCode(match[1]),
    credits: match[2] ? Number.parseFloat(match[2]) : undefined,
  };
}

function parseDisciplines(text: string): string[] {
  const afterIn = text.match(/\b(?:in|from)\s+(.+)$/i)?.[1] ?? "";
  const beforeLevel = afterIn.split(/\bat\s+the\b/i)[0] ?? afterIn;
  const disciplines = new Set<string>();
  for (const match of beforeLevel.matchAll(/\b([A-Z]{3,4})\b/g)) disciplines.add(match[1]);
  return Array.from(disciplines);
}

function parseDisciplineLevels(text: string): number[] | undefined {
  const normalized = text.replaceAll(/[–—]/g, "-");
  const levelClause = normalized.match(/\bat\s+the\s+(.+?)\s*[- ]?levels?\b/i);
  const simpleLevelClause = normalized.match(/\bat\s+the\s+(\d000)\s*[- ]?level\b/i);
  const source = levelClause?.[1] ?? simpleLevelClause?.[1];
  if (!source) return undefined;
  const numbers = Array.from(source.matchAll(/\b(\d000)\b/g), (match) =>
    Number.parseInt(match[1], 10),
  );
  if (numbers.length === 0) return undefined;
  if (/or\s+above|or\s+higher/i.test(normalized)) {
    const start = Math.min(...numbers);
    const levels: number[] = [];
    for (let level = start; level <= 4000; level += 1000) levels.push(level);
    return levels;
  }
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

function cleanRequirementTitle(text: string): string {
  return normalizeText(text).replace(/\s+\.$/, ".");
}

function parseProgramRequirementCommentWithStatus(
  text: string,
  credits?: number,
): RequirementParse {
  const title = cleanRequirementTitle(text);
  const effectiveCredits = credits ?? parseCredits(title);

  if (/\bfree electives?\b/i.test(title)) {
    return {
      parsed: true,
      requirement: { type: "free_elective", title, credits: effectiveCredits },
    };
  }

  const disciplines = parseDisciplines(title);
  if (disciplines.length > 0) {
    const levels = parseDisciplineLevels(title);
    return {
      parsed: true,
      requirement: {
        type: "discipline_elective",
        title,
        credits: effectiveCredits,
        disciplineLevels: disciplines.map((discipline) => ({
          discipline,
          ...(levels ? { levels } : {}),
        })),
      },
    };
  }

  return {
    parsed: false,
    requirement: { type: "elective", title, credits: effectiveCredits },
  };
}

export function parseProgramRequirementComment(text: string, credits?: number): ProgramRequirement {
  return parseProgramRequirementCommentWithStatus(text, credits).requirement;
}

function getBaseSlug(url: string): string {
  const withoutHash = url.split("#")[0] ?? url;
  const parts = withoutHash.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] ?? "program";
}

function anchorUrl(url: string, id: string): string {
  return `${url.split("#")[0]?.replace(/\/+$/, "") ?? url}/#${id}`;
}

function rowIndent($row: CheerioSelection): number {
  const style = $row.find('[style*="margin-left"]').first().attr("style") ?? "";
  const match = style.match(/margin-left:\s*(\d+)px/i);
  if (match) return Number.parseInt(match[1], 10);
  return $row.find(".commentindent").length > 0 ? 20 : 0;
}

function parseProgramTable(
  $: cheerio.CheerioAPI,
  table: CheerioNode,
  unparsed: string[],
  stats: ParseProgramPageStats,
): ProgramRequirement[] {
  const flat: ProgramRequirement[] = [];
  let currentGroup: ProgramRequirement | undefined;

  const pushRequirement = (requirement: ProgramRequirement, isIndented: boolean): void => {
    if (isIndented && currentGroup?.options) {
      currentGroup.options.push(requirement);
      return;
    }
    currentGroup = undefined;
    flat.push(requirement);
  };

  $(table)
    .find("tr")
    .each((_, row) => {
      const $row = $(row);
      if (($row.attr("class") ?? "").includes("listsum")) return;
      const text = normalizeText($row.text());
      if (!text) return;

      const isIndented = rowIndent($row) > 0;
      const hours = normalizeText($row.find("td.hourscol").first().text());
      const credits = parseCredits(hours);
      const comment = normalizeText($row.find(".courselistcomment").first().text());

      stats.totalRequirements++;

      if (($row.attr("class") ?? "").includes("areaheader")) {
        currentGroup = undefined;
        flat.push({ type: "section", title: comment || text });
        stats.parsedRequirements++;
        return;
      }

      if (comment) {
        if (/\b\d+(?:\.\d+)?\s+credits?\s+(?:in|from):\s*$/i.test(comment)) {
          currentGroup = {
            type: "group",
            title: comment,
            credits: credits ?? parseCredits(comment),
            options: [],
          };
          flat.push(currentGroup);
          stats.parsedRequirements++;
          return;
        }

        const parsed = parseProgramRequirementCommentWithStatus(comment, credits);
        if (parsed.parsed) {
          stats.parsedRequirements++;
        } else {
          unparsed.push(comment);
        }
        pushRequirement(
          { ...parsed.requirement, ...(isIndented ? { indented: true } : {}) },
          isIndented,
        );
        return;
      }

      const codeText = normalizeText($row.find("td.codecol").first().text());
      const parsedCode = parseCodeCell(codeText);
      if (parsedCode) {
        const title = normalizeText($row.find("td.titlecol").first().text()) || undefined;
        const requirement: ProgramRequirement = {
          type: "course",
          code: parsedCode.code,
          credits: parsedCode.credits ?? credits,
          ...(title ? { title } : {}),
          ...(isIndented ? { indented: true } : {}),
        };
        pushRequirement(requirement, isIndented);
        stats.parsedRequirements++;
        return;
      }

      const parsed = parseProgramRequirementCommentWithStatus(text, credits);
      if (parsed.parsed) {
        stats.parsedRequirements++;
      } else {
        unparsed.push(text);
      }
      pushRequirement(
        { ...parsed.requirement, ...(isIndented ? { indented: true } : {}) },
        isIndented,
      );
    });

  return processRequirements(flat);
}

export function parseProgramPage(html: string, url: string): ParseProgramPageResult {
  const $ = cheerio.load(html);
  const programs: Program[] = [];
  const unparsed: string[] = [];
  const stats: ParseProgramPageStats = { totalRequirements: 0, parsedRequirements: 0 };
  const baseSlug = getBaseSlug(url);

  $("h3[id]").each((_, heading) => {
    const id = $(heading).attr("id");
    if (!id) return;
    const tables = $(heading).nextUntil("h3[id]", "table.sc_courselist").toArray();
    if (tables.length === 0) return;

    const requirements = tables.flatMap((table) => parseProgramTable($, table, unparsed, stats));
    if (requirements.length === 0) return;

    programs.push({
      title: normalizeText($(heading).text()),
      url: anchorUrl(url, id),
      slug: `${baseSlug}#${id}`,
      requirements,
    });
  });

  return { programs, unparsed: Array.from(new Set(unparsed)), stats };
}
