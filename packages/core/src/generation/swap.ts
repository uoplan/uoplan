import type { CourseSchedule } from "../dataTypes";
import { enrollmentsOverlap } from "./overlaps";
import { getEnrollmentsForCourse, getValidSectionCombos } from "./sectionCombos";
import type { CourseEnrollment, GenerationConstraints } from "./types";

/**
 * Finds the first valid section combo for {@link scheduleData} (honouring
 * {@link constraints}) whose resulting enrollment doesn't overlap any of the
 * {@link others} already in the schedule, and returns that enrollment. Returns
 * `null` when no combo fits.
 *
 * This is the shared core of every "swap a course into a schedule" path
 * (OG-image reconstruction, the web swap replay, and the live swap action) so
 * the section-selection + conflict-checking logic lives in exactly one place.
 */
export function firstFittingEnrollment(
  scheduleData: CourseSchedule,
  constraints: GenerationConstraints,
  others: CourseEnrollment[],
): CourseEnrollment | null {
  const combos = getValidSectionCombos(scheduleData, constraints);
  for (const combo of combos) {
    const candidate = getEnrollmentsForCourse(scheduleData, combo);
    if (!others.some((e) => enrollmentsOverlap(e, candidate))) {
      return candidate;
    }
  }
  return null;
}

/**
 * Boolean form of {@link firstFittingEnrollment}: true when at least one valid,
 * non-overlapping section combo exists for the course against {@link others}.
 */
export function courseFitsWith(
  scheduleData: CourseSchedule,
  constraints: GenerationConstraints,
  others: CourseEnrollment[],
): boolean {
  return firstFittingEnrollment(scheduleData, constraints, others) !== null;
}
