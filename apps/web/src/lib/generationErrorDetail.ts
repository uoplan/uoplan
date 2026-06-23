import type { GenerationErrorDetails } from "../store/types";

/**
 * True when a generation error carries structured context worth showing beyond
 * the concise headline (unmet slots, empty pools, courses with no sections, or
 * quick-fix suggestions). Drives whether the error toast offers "View details".
 */
export function hasDetailContent(errorDetails: GenerationErrorDetails): boolean {
  if (errorDetails.totalAvailable < errorDetails.totalNeeded) return true;
  if (errorDetails.emptyPools.length > 0) return true;
  const tf = errorDetails.timetableFailure;
  if (!tf) return false;
  if (tf.coursesWithNoCombo.length > 0) return true;
  if (tf.suggestions.length > 0) return true;
  return false;
}
