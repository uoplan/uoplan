// Non-course prerequisite handling: coarse classification of opaque requirements
// (permission, standing, language, …) plus level/discipline enrichment used by
// the clause parser.

import { extractCourseCodes } from "../shared/text.ts";
import type { CoursePrereqKind, CoursePrereqNode } from "./schema.ts";
import { extractDisciplines, parseCreditRequirement } from "./prereqText.ts";

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
export function annotateNonCourseKinds(node: CoursePrereqNode): CoursePrereqNode {
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

export function isGradeIndicator(text: string): boolean {
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
export function normalizeLevelOrDisjunction(text: string): string {
  return text.replaceAll(/\b(\d{4})\s+(or|ou)\s+(\d{4})\b/gi, "$1/$3");
}

/**
 * "12 course units in CSI or SDS" shares one credit pool across disciplines — wrap so
 * extractDisciplines finds them and tryMergeSharedCreditDisciplineOr can merge.
 */
export function normalizeDisciplineOrInCredits(text: string): string {
  return text
    .replaceAll(/\bin\s+([A-Z]{3,4})\s+or\s+([A-Z]{3,4})\b/gi, "in ($1) or ($2)")
    .replaceAll(/\bdans\s+([A-Z]{3,4})\s+ou\s+([A-Z]{3,4})\b/gi, "dans ($1) ou ($2)");
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

/**
 * "18 units in (CSI) or software engineering (SEG) at the … level" shares one credit pool across
 * discipline branches — do not emit a separate or_group per `or`.
 */
export function tryMergeSharedCreditDisciplineOr(
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

export function enrichNonCourseWithLevels(
  node: CoursePrereqNode,
  sourceText: string,
): CoursePrereqNode {
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
