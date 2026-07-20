// Recursive clause parser: turns a single prerequisite clause into a
// CoursePrereqNode tree (and/or groups, course codes, credit pools). All the
// mutual recursion lives here so it stays inside one module.

import { extractCourseCodes } from "../shared/text.ts";
import type { CoursePrereqNode } from "./schema.ts";
import {
  enrichNonCourseWithLevels,
  isGradeIndicator,
  normalizeDisciplineOrInCredits,
  normalizeLevelOrDisjunction,
  tryMergeSharedCreditDisciplineOr,
} from "./prereqNonCourse.ts";
import {
  extractDisciplines,
  parseCreditRequirement,
  splitTopLevel,
  stripOuterParensOnce,
} from "./prereqText.ts";

// Common abbreviations that shouldn't trigger splits
const ABBREVIATIONS = new Set(["b.com", "m.com", "b.a", "m.a", "m.sc", "ph.d", "b.mus", "b.eng"]);

function hasTopLevelOr(text: string): boolean {
  return splitTopLevel(text, /\s+(?:or|ou)\s+/i).length > 1;
}

function shouldSplitPrereqAndAt(left: string, right: string): boolean {
  const leftTrim = left.trim().toLowerCase();
  const rightRaw = right.trim();
  const rightTrim = rightRaw.toLowerCase();

  // Check if left ends with an abbreviation like B.Com
  const leftEnd = leftTrim.slice(-6).toLowerCase();
  for (const abbrev of ABBREVIATIONS) {
    if (leftEnd.includes(abbrev)) return false;
  }

  // A leading "(" or a leading course code only forces an AND-split when the right
  // operand has no top-level or/ou — otherwise OR binds wider (e.g. "A and B or C" is
  // "(A and B) or C", not "A and (B or C)") and we defer to the OR split.
  if (rightTrim.startsWith("(") && !hasTopLevelOr(rightRaw)) return true;
  if (/^[A-Z]{3,4}\s*\d{4}/.test(rightRaw) && !hasTopLevelOr(rightRaw)) return true;
  if (leftTrim.endsWith(")")) return true;

  // Only split on digit if it looks like a credit count (1-3 digits, not 4-digit level/course code)
  const creditMatch = rightTrim.match(/^(\d+)\s/);
  if (creditMatch) {
    const num = creditMatch[1];
    // 4-digit numbers are likely course codes or levels, not credit counts
    if (num.length === 4) return false;
    return true;
  }

  return false;
}

function shouldSplitPrereqEtAt(left: string, right: string): boolean {
  const leftTrim = left.trim().toLowerCase();
  const rightRaw = right.trim();
  const rightTrim = rightRaw.toLowerCase();
  if (rightTrim.startsWith("(") && !hasTopLevelOr(rightRaw)) return true;
  if (/^[A-Z]{3,4}\s*\d{4}/.test(rightRaw) && !hasTopLevelOr(rightRaw)) return true;
  if (leftTrim.endsWith(")")) return true;
  if (/^(\d+(?:\.\d+)?)\s/.test(rightTrim) && !/\s+ou\s+/.test(leftTrim)) return true;
  return false;
}

function parseExplicitCreditPool(inner: string): CoursePrereqNode | undefined {
  const credits = parseCreditRequirement(inner);
  if (credits === undefined) return undefined;
  if (
    !/\b(?:from|among|parmi|parmis|of the following|de la liste suivante|des cours suivants)\b/i.test(
      inner,
    )
  ) {
    return undefined;
  }
  const codes = extractCourseCodes(inner);
  if (codes.length === 0) return undefined;
  const firstCode = inner.search(/\b[A-Z]{3,4}\s*\d{4}\b/);
  const preCode = firstCode >= 0 ? inner.slice(0, firstCode) : inner;
  if (
    !/\b(?:from|among|parmi|parmis|of the following|de la liste suivante|des cours suivants)\b/i.test(
      preCode,
    )
  ) {
    return undefined;
  }
  return {
    type: "non_course",
    text: inner,
    credits,
    children: codes.map((code) => ({ type: "course", code })),
  };
}

function parseIncludingCreditGate(inner: string): CoursePrereqNode | undefined {
  const match = inner.match(
    /^(.+?\b(?:units?|credits?|cr[ée]dits?|unit[ée]s?)\b.*?)\s+(?:including|incluant|y\s+compris)\s+(.+)$/i,
  );
  if (!match) return undefined;
  const gateText = match[1].trim();
  const includedText = match[2].trim();
  const credits = parseCreditRequirement(gateText);
  if (credits === undefined || !includedText) return undefined;
  const included = parsePrereqClause(includedText);
  if (!included) return undefined;
  return {
    type: "and_group",
    text: inner,
    children: [{ type: "non_course", text: gateText, credits }, included],
  };
}

function parseLeadingOneOf(inner: string): CoursePrereqNode | undefined {
  const match = inner.match(
    /^(?:one\s+of|at\s+least\s+one\s+of|l['’]un(?:e)?\s+des|au\s+moins\s+un(?:e)?\s+(?:des?|de)|un(?:e)?\s+des?|un(?:e)?\s+de)\s+(.+)$/i,
  );
  if (!match) return undefined;
  const listText = match[1].trim();
  const commaParts = splitTopLevel(listText, /,/);
  const rawParts = commaParts.length > 1 ? commaParts : splitTopLevel(listText, /\s+(?:or|ou)\s+/i);
  if (rawParts.length < 2) return undefined;

  const children: CoursePrereqNode[] = [];
  for (const rawPart of rawParts) {
    const node = parsePrereqClause(rawPart.trim());
    if (!node) continue;
    if (node.type === "or_group") children.push(...(node.children ?? []));
    else children.push(node);
  }
  if (children.length === 0) return undefined;
  if (children.length === 1) return children[0];
  return { type: "or_group", text: inner, children };
}

function parsePrereqConjunction(
  inner: string,
  separators: RegExp,
  shouldSplitAt: (left: string, right: string) => boolean,
): CoursePrereqNode | undefined {
  const parts = splitTopLevel(inner, separators);
  if (parts.length <= 1) return undefined;

  let allBoundariesValid = true;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!shouldSplitAt(parts[i], parts[i + 1])) {
      allBoundariesValid = false;
      break;
    }
  }
  if (!allBoundariesValid) return undefined;

  return parsePrereqPartsAsGroup(parts, "and_group", inner);
}

function parsePrereqPartsAsGroup(
  parts: string[],
  type: "and_group" | "or_group",
  text: string,
): CoursePrereqNode | undefined {
  const children: CoursePrereqNode[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const node = parsePrereqClause(trimmed);
    if (node) children.push(node);
  }
  if (children.length === 0) return undefined;
  if (children.length === 1) return children[0];
  return { type, text, children };
}

export function parsePrereqClause(clause: string): CoursePrereqNode | undefined {
  let inner = clause.replaceAll(/\s+/g, " ").trim();
  if (!inner) return undefined;
  inner = inner.replace(/^(?:and|et)\s+/i, "").trim();
  if (!inner) return undefined;

  // Skip standalone grade indicators like (M), (B+), (A-)
  if (isGradeIndicator(inner)) return undefined;

  const includingCreditGate = parseIncludingCreditGate(inner);
  if (includingCreditGate) return includingCreditGate;

  const explicitCreditPool = parseExplicitCreditPool(inner);
  if (explicitCreditPool) return explicitCreditPool;

  const leadingOneOf = parseLeadingOneOf(inner);
  if (leadingOneOf) return leadingOneOf;

  // Detect multiple top-level parenthesized groups, e.g.
  // (ADM 1705 ou MAT 1702), (ADM 1770 ou ITI 1520)
  const groupContents: string[] = [];
  const groupRanges: Array<{ start: number; end: number }> = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ")" && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        groupContents.push(inner.slice(start + 1, i).trim());
        groupRanges.push({ start, end: i });
        start = -1;
      }
    }
  }

  if (groupContents.length > 1) {
    let outside = "";
    let lastIndex = 0;
    for (const range of groupRanges) {
      outside += inner.slice(lastIndex, range.start);
      lastIndex = range.end + 1;
    }
    outside += inner.slice(lastIndex);
    if (outside.replaceAll(/[,\s]+/g, "") === "") {
      return parsePrereqPartsAsGroup(groupContents, "and_group", inner);
    }
  }

  // Handle clauses like "ECO 1502, ECO 1504, (ADM 1740 ou ADM 2740)"
  // by treating comma-separated top-level segments as an implicit AND.
  // Also handles "CHM 3120, CHM 4120, CHM 4125, equivalent. or A basic knowledge..."
  if (inner.includes(",") && (inner.includes("(") || /,\s*equivalent\.?\s+or\s+/i.test(inner))) {
    const commaParts = splitTopLevel(inner, /,/);
    if (commaParts.length > 1) {
      return parsePrereqPartsAsGroup(commaParts, "and_group", inner);
    }
  }

  // Split "((X) or Y) and 12 course units in …" / "SEG 2105 and 6 university course units …"
  // at depth 0 so nested `or` inside parentheses is parsed before top-level discipline OR.
  const englishAnd = parsePrereqConjunction(inner, /\s+and\s+/i, shouldSplitPrereqAndAt);
  if (englishAnd) return englishAnd;

  const frenchEt = parsePrereqConjunction(inner, /\s+et\s+/i, shouldSplitPrereqEtAt);
  if (frenchEt) return frenchEt;

  // Strip redundant outer parentheses (e.g. `((MAT 2371, STA 2100) or STA 2391)` → inner OR at depth 0).
  while (true) {
    const peeled = stripOuterParensOnce(inner);
    if (peeled === undefined || peeled === "") break;
    inner = peeled;
  }
  if (!inner) return undefined;

  // Detect "X or Y for students enrolled in A (P1) or B (P2) programs or Z for all other students"
  const enrolledPattern =
    /^(.*?)\s+for students enrolled in\s+(.*?)\s+programs?\s+or\s+(.*?)\s+for all other students$/i;
  const enrolledMatch = inner.match(enrolledPattern);
  if (enrolledMatch) {
    const coursesText = enrolledMatch[1].trim();
    const programsText = enrolledMatch[2].trim();
    const fallbackText = enrolledMatch[3].trim();

    const programs = extractDisciplines(programsText);
    const conditionalBase = parsePrereqClause(coursesText);
    const fallbackNode = parsePrereqClause(fallbackText);

    if (!conditionalBase && !fallbackNode) return undefined;
    if (!conditionalBase) return fallbackNode;
    const conditionalNode: CoursePrereqNode = {
      type: conditionalBase.type,
      ...(conditionalBase.code !== undefined ? { code: conditionalBase.code } : {}),
      ...(conditionalBase.text !== undefined ? { text: conditionalBase.text } : {}),
      ...(conditionalBase.credits !== undefined ? { credits: conditionalBase.credits } : {}),
      ...(conditionalBase.disciplines !== undefined
        ? { disciplines: conditionalBase.disciplines }
        : {}),
      ...(conditionalBase.levels !== undefined ? { levels: conditionalBase.levels } : {}),
      ...(conditionalBase.disciplineLevels !== undefined
        ? { disciplineLevels: conditionalBase.disciplineLevels }
        : {}),
      programs,
      ...(conditionalBase.children !== undefined ? { children: conditionalBase.children } : {}),
    };
    if (!fallbackNode) return conditionalNode;

    return {
      type: "or_group",
      text: inner,
      children: [conditionalNode, fallbackNode],
    };
  }

  const orRegex = /\s+(or|ou)\s+/i;
  const innerForOr = normalizeDisciplineOrInCredits(normalizeLevelOrDisjunction(inner));
  const hasOr = orRegex.test(innerForOr);

  if (hasOr) {
    const orParts = splitTopLevel(innerForOr, orRegex);
    const merged = tryMergeSharedCreditDisciplineOr(orParts, innerForOr);
    if (merged) return merged;

    const children: CoursePrereqNode[] = [];
    for (const part of orParts) {
      const partTrim = part.trim().replace(/^[,]+/, "").trim();
      if (!partTrim) continue;
      const codes = extractCourseCodes(partTrim);
      const credits = parseCreditRequirement(partTrim);
      const disciplines = extractDisciplines(partTrim);
      if (codes.length === 0) {
        children.push(
          enrichNonCourseWithLevels(
            {
              type: "non_course",
              text: partTrim,
              credits,
              disciplines: disciplines.length > 0 ? disciplines : undefined,
            },
            partTrim,
          ),
        );
      } else if (codes.length === 1) {
        if (credits !== undefined) {
          children.push({
            type: "and_group",
            text: partTrim,
            children: [
              { type: "course", code: codes[0] },
              enrichNonCourseWithLevels(
                {
                  type: "non_course",
                  text: partTrim,
                  credits,
                },
                partTrim,
              ),
            ],
          });
        } else {
          children.push({
            type: "course",
            code: codes[0],
            text: partTrim,
          });
        }
      } else {
        const childNodes: CoursePrereqNode[] = codes.map((code) => ({ type: "course", code }));
        if (credits !== undefined) {
          childNodes.push(
            enrichNonCourseWithLevels(
              {
                type: "non_course",
                text: partTrim,
                credits,
              },
              partTrim,
            ),
          );
        }
        children.push({
          type: "and_group",
          text: partTrim,
          children: childNodes,
        });
      }
    }
    if (children.length === 0) return undefined;
    if (children.length === 1) return children[0];
    return {
      type: "or_group",
      text: innerForOr,
      children,
    };
  }

  const codes = extractCourseCodes(inner);
  const credits = parseCreditRequirement(inner);
  const disciplines = extractDisciplines(inner);
  if (codes.length === 0) {
    return enrichNonCourseWithLevels(
      {
        type: "non_course",
        text: inner,
        credits,
        disciplines: disciplines.length > 0 ? disciplines : undefined,
      },
      inner,
    );
  }
  if (codes.length === 1 && credits === undefined) {
    return {
      type: "course",
      code: codes[0],
      text: inner,
    };
  }

  const children: CoursePrereqNode[] = codes.map((code) => ({ type: "course", code }));
  if (credits !== undefined) {
    children.push(enrichNonCourseWithLevels({ type: "non_course", text: inner, credits }, inner));
  }
  if (children.length === 1) return children[0];
  return {
    type: "and_group",
    text: inner,
    children,
  };
}
