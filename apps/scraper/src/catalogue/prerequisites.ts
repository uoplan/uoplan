// Course prerequisite parsing entry point. Turns raw catalogue prose into a
// structured CoursePrereqNode tree. Implementation is split across cohesive
// siblings; this file owns the top-level clause-splitting orchestration and
// re-exports the public API.
//
//   prereqText.ts      — leaf text primitives (split/credit/discipline)
//   prereqSentence.ts  — extract the prerequisite sentence from bilingual prose
//   prereqNonCourse.ts — classify + enrich opaque non-course requirements
//   prereqClause.ts    — recursive clause → CoursePrereqNode parser

import type { CoursePrereqNode } from "./schema.ts";
import { annotateNonCourseKinds, isGradeIndicator } from "./prereqNonCourse.ts";
import { parsePrereqClause } from "./prereqClause.ts";
import { splitTopLevel } from "./prereqText.ts";

export { classifyNonCourse, parseLevelsFromClause } from "./prereqNonCourse.ts";
export { extractPrereqSentence } from "./prereqSentence.ts";
export { extractDisciplines, parseCreditRequirement } from "./prereqText.ts";

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
