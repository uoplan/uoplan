/**
 * Personalization "completeness" signal for the Personalize tab.
 *
 * The Personalize wizard collects a program, a first year of study, and any
 * already-completed courses. When the user has provided NONE of these, the
 * bottom-tab shows a small indicator badge nudging them to personalize. As soon
 * as any single input is supplied, the nudge clears. (Term is excluded because
 * it auto-defaults to the latest term, so it is never genuinely "empty".)
 */
export interface PersonalizationStatusInput {
  programUrl: string | null;
  startYear: string | null;
  completedCourseCount: number;
}

export function isPersonalizationIncomplete({
  programUrl,
  startYear,
  completedCourseCount,
}: PersonalizationStatusInput): boolean {
  return programUrl === null && startYear === null && completedCourseCount === 0;
}
