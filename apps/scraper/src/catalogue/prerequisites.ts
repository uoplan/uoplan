import { extractCourseCodes } from "../shared/text.ts";
import type { CoursePrereqKind, CoursePrereqNode } from "./schema.ts";

// Ontario high-school course codes like MCV4U, MHF4U, SBI4U, OAC.
const HS_CODE_RE = /\b([A-Z]{3}4[A-Z]|OAC|CPO)\b/;
const HS_HINT_RE =
  /\b4U\b|Ontario|Calculus and Vectors|Advanced Functions|fonctions avanc|calcul et vecteurs|niveau secondaire/i;

/**
 * Classify an opaque `non_course` prerequisite (one with no credit pool and no
 * extractable course codes) into a coarse {@link CoursePrereqKind}. Returns
 * `undefined` when the text doesn't match any known shape (kept conservative —
 * the evaluator treats unclassified opaque requirements as blocking).
 *
 * Ordering matters: more specific / higher-confidence patterns are tested first.
 */
export function classifyNonCourse(text: string): CoursePrereqKind | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const low = t.toLowerCase();

  // permission / consent / approval by some authority
  if (
    /\b(permission|consent|approval|approbation)\b/i.test(t) ||
    /\b(autorisation|permission)\s+(du|de|de la|de l')/i.test(t)
  ) {
    return "permission";
  }
  // audition / interview
  if (/\baudition\b|\bentrevue\b|\binterview\b/i.test(low)) {
    return "audition";
  }
  // language test / placement / passive knowledge of a language
  if (
    /language test|test de langue|placement test|test de classement|passive knowledge|connaissance (passive|active|fondamentale)|knowledge of (french|english|italian)|connaissance.+(anglais|fran)|literacy in (english|french)|biliter/i.test(
      t,
    )
  ) {
    return "language";
  }
  // "equivalent" / "the equivalent" (conservative kind — stays blocking)
  if (
    /^(l'|the |its |son )?[ée]quivalent[.\s]*$/i.test(low) ||
    (/\bequivalent\b/.test(low) && t.length <= 30)
  ) {
    return "equivalent";
  }
  // Ontario high-school course
  if (HS_CODE_RE.test(t) || HS_HINT_RE.test(t)) {
    return "highschool";
  }
  // CGPA / average threshold (English + French MPC / moyenne)
  if (/\b(cgpa|gpa)\b|\baverage\b|\bmoyenne\b|\bMPC\b|grade point/i.test(t)) {
    return "standing";
  }
  // year standing / graduate standing / program-year completion / enrolment
  if (
    /graduate standing|undergraduate standing|\b\d(st|nd|rd|th)[- ]year\b|\d(i[èe]me|e|er)\s*ann[ée]e|quatri[èe]me ann|troisi[èe]me ann|year of|completion of (the )?(\w+ )?(year|third|fourth)|ach[èe]vement|avoir (suivi|compl[ée]t|r[ée]ussi)|r[ée]serv[ée] aux|open to|inscrit|enrol|admission (to|au)|registered in|completed (all )?(required|compulsory)/i.test(
      t,
    )
  ) {
    return "standing";
  }
  // topic-dependent ("to be determined", "according to the topic")
  if (/to be determined|according to the topic|selon les th[èe]mes|[àa] d[ée]terminer/i.test(t)) {
    return "topic";
  }
  // prior coursework / program completion phrased as prose (no extractable codes)
  if (
    /completion of (all )?(compulsory|required)|all .*core courses|tous les cours|r[ée]ussite de|deux \(2\) cours|c[ée]gep|undergraduate (honours )?algebra|honours undergraduate|university courses? in|cours universitaires/i.test(
      t,
    )
  ) {
    return "coursework";
  }
  // domain knowledge / familiarity (non-language)
  if (
    /knowledge of|familiarity with|connaissance (de|du|en|fondamentale)|some familiarity|solide connaissance/i.test(
      t,
    )
  ) {
    return "knowledge";
  }
  // recommended (soft / advisory)
  if (/recommend|fortement recommand/i.test(t)) {
    return "recommended";
  }
  return undefined;
}

/**
 * Walk a parsed prerequisite tree and annotate every opaque `non_course` node
 * with a {@link CoursePrereqKind}. "Opaque" = no credit pool and no
 * discipline/level constraints (those are already structured). Mutates and
 * returns the same tree. `kind` is additive metadata only — it does not change
 * node structure, so regression comparisons against the old parser are
 * unaffected.
 */
function annotateNonCourseKinds(node: CoursePrereqNode): CoursePrereqNode {
  if (
    node.type === "non_course" &&
    node.kind === undefined &&
    node.credits == null &&
    !node.disciplines?.length &&
    !node.disciplineLevels?.length &&
    node.text
  ) {
    const kind = classifyNonCourse(node.text);
    if (kind) node.kind = kind;
  }
  if (node.children) {
    for (const child of node.children) annotateNonCourseKinds(child);
  }
  return node;
}

function isGradeIndicator(text: string): boolean {
  const trimmed = text.trim();
  // Pattern 1: letter grades A-F with optional +/- and "or higher"
  const gradePattern = /^\([A-F][+-]?\s*(or higher|ou supérieur)?\)$/i;
  // Pattern 2: single letters like (H), (M), (B) - honors, math, standing
  const singleLetterPattern = /^\([A-Z]\)$/;
  // Pattern 3: two-letter standing codes like (HP), (HS), etc.
  const twoLetterPattern = /^\([A-Z]{2}\)$/;
  return (
    gradePattern.test(trimmed) ||
    singleLetterPattern.test(trimmed) ||
    twoLetterPattern.test(trimmed)
  );
}
/**
 * "at the 3000 or 4000 level" / "niveau 3000 ou 4000" must not split on the inner `or`/`ou`.
 */
function normalizeLevelOrDisjunction(text: string): string {
  return text.replaceAll(/\b(\d{4})\s+(or|ou)\s+(\d{4})\b/gi, "$1/$3");
}

/**
 * "12 course units in CSI or SDS" shares one credit pool across disciplines — wrap so
 * extractDisciplines finds them and tryMergeSharedCreditDisciplineOr can merge.
 */
function normalizeDisciplineOrInCredits(text: string): string {
  return text
    .replaceAll(/\bin\s+([A-Z]{3,4})\s+or\s+([A-Z]{3,4})\b/gi, "in ($1) or ($2)")
    .replaceAll(/\bdans\s+([A-Z]{3,4})\s+ou\s+([A-Z]{3,4})\b/gi, "dans ($1) ou ($2)");
}

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

/**
 * Extracts 1000/2000/… level numbers from prerequisite text (English + French).
 * Replaces the narrower `at the … level`-only helper used for program electives.
 */
function extractLevelsFromPrerequisiteText(text: string): number[] | undefined {
  const normalized = normalizeLevelOrDisjunction(text);
  const found = new Set<number>();

  const atThe = normalized.match(/\bat the\s+([^.;]+?)\s+level\b/i);
  if (atThe) {
    const nums = atThe[1].match(/\b(\d{4})\b/g);
    if (nums) for (const n of nums) found.add(parseInt(n, 10));
  }

  const frNiveau = normalized.match(/\b(?:de|au)\s+niveau\s+([^.;]+)/i);
  if (frNiveau) {
    const nums = frNiveau[1].match(/\b(\d{4})\b/g);
    if (nums) for (const n of nums) found.add(parseInt(n, 10));
  }

  if (found.size === 0) return undefined;
  return Array.from(found).sort((a, b) => a - b);
}

export function parseLevelsFromClause(text: string): number[] | undefined {
  return extractLevelsFromPrerequisiteText(text);
}

export function extractDisciplines(text: string): string[] {
  const disciplineRegex = /\(([A-Z]{3,4})\)/g;
  const disciplines: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = disciplineRegex.exec(text)) !== null) disciplines.push(match[1]);
  return Array.from(new Set(disciplines));
}

const EN_PREREQ_LABEL_SOURCE = String.raw`(?:P?Prerequisites?|Prererequisites?|Prerequistes?)`;
const FR_PREREQ_LABEL_SOURCE = String.raw`(?:P?Pr[ée]alables?|Pr[ée]requis?s?)`;
const ANY_PREREQ_LABEL_SOURCE = String.raw`(?:${EN_PREREQ_LABEL_SOURCE}|${FR_PREREQ_LABEL_SOURCE})`;

function prereqLabelRegex(source: string, flags = "i"): RegExp {
  return new RegExp(source, flags);
}

export function extractPrereqSentence(raw: string): string | undefined {
  const normalized = raw.replaceAll(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  // Check if text has bilingual format (contains both French and English labels)
  // Extract the first language version (whichever appears first in the text)
  const englishLabel = prereqLabelRegex(`${EN_PREREQ_LABEL_SOURCE}\\s*[:：]`);
  const frenchLabel = prereqLabelRegex(`${FR_PREREQ_LABEL_SOURCE}\\s*[:：]`);
  const hasEnglishLabel = englishLabel.test(normalized);
  const hasFrenchLabel = frenchLabel.test(normalized);

  if (hasEnglishLabel && hasFrenchLabel) {
    // Find positions of both labels to determine which comes first
    const englishMatch = normalized.match(englishLabel);
    const frenchMatch = normalized.match(frenchLabel);

    if (englishMatch && frenchMatch) {
      const englishPos = englishMatch.index ?? 0;
      const frenchPos = frenchMatch.index ?? 0;

      if (englishPos < frenchPos) {
        // English comes first - extract until "/ Préalable" or end
        const textMatch = normalized.match(
          prereqLabelRegex(
            `${EN_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*(.*?)(?:\\s*\\/\\s*${FR_PREREQ_LABEL_SOURCE}|$)`,
          ),
        );
        if (textMatch && textMatch[1]) {
          return extractFirstSentence(textMatch[1].trim());
        }
      } else {
        // French comes first - extract until "/ Prerequisite" or end
        const textMatch = normalized.match(
          prereqLabelRegex(
            `${FR_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*(.*?)(?:\\s*\\/\\s*${EN_PREREQ_LABEL_SOURCE}|$)`,
          ),
        );
        if (textMatch && textMatch[1]) {
          return extractFirstSentence(textMatch[1].trim());
        }
      }
    }
  }

  const labelRegex = prereqLabelRegex(`${ANY_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*`);
  if (!labelRegex.test(normalized)) return undefined;

  const afterLabel = normalized.replace(
    prereqLabelRegex(`^(.*?)${ANY_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*`),
    "",
  );
  const trimmed = afterLabel.trim();
  if (!trimmed) return undefined;

  // Find sentence boundary, but be smart about abbreviations
  // Common abbreviations that contain periods: B.Com, B.A., M.A., M.Sc., Ph.D., etc.
  // Also single letters in parentheses like (B) or (B.A.)
  let sentenceEnd = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === ".") {
      // Check if this looks like an abbreviation
      const before = trimmed.slice(Math.max(0, i - 10), i);
      const after = trimmed.slice(i + 1, Math.min(trimmed.length, i + 20));

      // Check for common abbreviations (single letter + period + optional more letters)
      if (
        (/\b[A-Z]$/.test(before) || /\b[A-Z]\.$/.test(before)) &&
        /^[A-Za-z]/.test(after) &&
        !/^[A-Z]/.test(after)
      ) {
        // Could be B., M., etc. - likely part of abbreviation like B.Com, M.Sc.
        continue;
      }

      // Check if period is inside parentheses - likely abbreviation
      const parenBefore = trimmed.slice(0, i).lastIndexOf("(");
      const parenAfter = trimmed.indexOf(")", i);
      if (parenBefore !== -1 && parenAfter !== -1 && parenAfter > i) {
        // Period is inside parentheses - likely abbreviation context
        const parenContent = trimmed.slice(parenBefore, parenAfter + 1);
        if (/\([A-Z][.]?\)/.test(parenContent)) {
          continue;
        }
      }

      // This looks like a sentence-ending period
      // Either followed by space+letter, or end of string
      // Also stop at periods before bilingual separator like " / Prerequisites:"
      const afterPeriod = trimmed.slice(i, i + 20);
      if (
        i === trimmed.length - 1 ||
        /\s+[A-Z]/.test(trimmed.slice(i, i + 3)) ||
        prereqLabelRegex(`\\s*\\/\\s*${ANY_PREREQ_LABEL_SOURCE}`).test(afterPeriod)
      ) {
        sentenceEnd = i;
        break;
      }
    }
  }

  const sentence = (sentenceEnd === -1 ? trimmed : trimmed.slice(0, sentenceEnd)).trim();
  return sentence || undefined;
}

// Helper function to extract first sentence from text
function extractFirstSentence(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Find first sentence-ending period (simplified logic)
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === ".") {
      // Check if this is part of an abbreviation or decimal
      const before = trimmed.slice(Math.max(0, i - 2), i);
      const after = trimmed.slice(i + 1, Math.min(trimmed.length, i + 3));

      // Skip decimal numbers (digit.digit)
      if (/\d$/.test(before) && /^\d/.test(after)) {
        continue;
      }

      // Check for abbreviations
      if (/\s+[A-Z]/.test(trimmed.slice(i, i + 3))) {
        return trimmed.slice(0, i).trim();
      }
    }
  }

  // Strip trailing period if present
  return trimmed.replace(/\.$/, "").trim();
}

export function parseCreditRequirement(text: string): number | undefined {
  // Match both English (credit/credits) and French (crédit/crédits/unit/unités)
  const match = text.match(/(\d+(?:\.\d+)?)[^0-9]*?(?:units?|cr[ée]dits?|unit[ée]s?)\b/i);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  return Number.isNaN(value) ? undefined : value;
}

function splitTopLevel(text: string, separators: RegExp): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);

    if (depth === 0) {
      const rest = text.slice(i);
      const m = rest.match(separators);
      if (m && m.index === 0) {
        if (current.trim()) parts.push(current.trim());
        current = "";
        i += m[0].length - 1;
        continue;
      }
    }

    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Remove one outer `(...)` layer when the whole string is a single balanced group. */
function stripOuterParensOnce(inner: string): string | undefined {
  if (!inner.startsWith("(") || !inner.endsWith(")")) return undefined;
  let depth2 = 0;
  let wrapsAll = true;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") {
      depth2++;
    } else if (ch === ")") {
      depth2--;
      if (depth2 === 0 && i < inner.length - 1) {
        wrapsAll = false;
        break;
      }
    }
    if (depth2 < 0) {
      wrapsAll = false;
      break;
    }
  }
  if (wrapsAll && depth2 === 0) {
    return inner.slice(1, -1).trim();
  }
  return undefined;
}

/**
 * "18 units in (CSI) or software engineering (SEG) at the … level" shares one credit pool across
 * discipline branches — do not emit a separate or_group per `or`.
 */
function tryMergeSharedCreditDisciplineOr(
  orParts: string[],
  fullText: string,
): CoursePrereqNode | undefined {
  if (orParts.length < 2) return undefined;
  if (orParts.some((p) => extractCourseCodes(p).length > 0)) return undefined;
  const c0 = parseCreditRequirement(orParts[0]);
  if (c0 === undefined) return undefined;
  if (!orParts.slice(1).every((p) => parseCreditRequirement(p) === undefined)) return undefined;
  const allDisciplines = Array.from(new Set(orParts.flatMap((p) => extractDisciplines(p))));
  if (allDisciplines.length === 0) return undefined;
  const levels = extractLevelsFromPrerequisiteText(fullText);
  const base: CoursePrereqNode = {
    type: "non_course",
    text: fullText,
    credits: c0,
    disciplines: allDisciplines,
  };
  if (levels?.length) {
    return {
      ...base,
      disciplineLevels: allDisciplines.map((d) => ({ discipline: d, levels })),
    };
  }
  return base;
}

function enrichNonCourseWithLevels(node: CoursePrereqNode, sourceText: string): CoursePrereqNode {
  if (node.type !== "non_course") return node;
  if (node.credits == null && !node.disciplines?.length) return node;
  const levels = extractLevelsFromPrerequisiteText(sourceText);
  if (!levels?.length) return node;

  if (node.disciplines?.length) {
    return {
      ...node,
      disciplineLevels: node.disciplines.map((d) => ({ discipline: d, levels })),
    };
  }
  return { ...node, levels };
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

function parsePrereqClause(clause: string): CoursePrereqNode | undefined {
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

export function parseCoursePrerequisites(text: string): CoursePrereqNode | undefined {
  // Strip U+00AD soft hyphens (invisible discretionary hyphens from the source HTML)
  // so they don't break token/parenthesis boundary detection (e.g. a trailing "…)\u00ad").
  const body = text.replaceAll("­", "").replaceAll(/\s+/g, " ").trim();
  if (!body) return undefined;

  // Split on semicolons or periods, but not:
  // - periods within decimal numbers (e.g., 7.5)
  // - periods in common abbreviations (e.g., B.Com, B.A. - period followed by uppercase letter)
  // - periods followed by ' or' (e.g., 'equivalent. or')
  const clauseSeparators = /;|(?<!\d)\.(?!\d)(?!\s+or\s)(?![a-z]\b)(?!\s*[A-Z])/i;
  const clauses = splitTopLevel(body, clauseSeparators);
  const clauseNodes: CoursePrereqNode[] = [];

  for (const clause of clauses) {
    if (!clause) continue;
    // Skip grade indicators like (M), (B+), (B+ or higher)
    if (isGradeIndicator(clause)) continue;
    const node = parsePrereqClause(clause);
    if (node) clauseNodes.push(node);
  }

  if (clauseNodes.length === 0) return undefined;
  if (clauseNodes.length === 1) return annotateNonCourseKinds(clauseNodes[0]);

  return annotateNonCourseKinds({
    type: "and_group",
    children: clauseNodes,
  });
}
