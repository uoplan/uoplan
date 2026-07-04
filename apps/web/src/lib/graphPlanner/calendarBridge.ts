/**
 * Glue between the degree planner graph and the single-term calendar view.
 *
 * The planner plans several future terms at once; the calendar edits one term
 * closely. "Open in calendar" seeds the calendar's cart with a term's planned
 * courses; when the student returns to the graph we reconcile whatever they
 * ended up with in the calendar back into that term's plan.
 */

/** Minimal shape of a generated schedule this bridge needs (avoids a core dep). */
export interface ReconcilableSchedule {
  enrollments: { courseCode: string }[];
}

/**
 * The course codes a future term should show after the student edited it in the
 * calendar. Prefers the courses actually scheduled there (the most accurate
 * picture of the term), falling back to the "courses you want" cart when no
 * schedule has been generated yet.
 */
export function planCoursesFromCalendar(
  currentSchedule: ReconcilableSchedule | null | undefined,
  basketCourses: readonly string[],
): string[] {
  if (currentSchedule && currentSchedule.enrollments.length > 0) {
    const seen = new Set<string>();
    const codes: string[] = [];
    for (const enrollment of currentSchedule.enrollments) {
      if (seen.has(enrollment.courseCode)) continue;
      seen.add(enrollment.courseCode);
      codes.push(enrollment.courseCode);
    }
    return codes;
  }
  return [...basketCourses];
}
