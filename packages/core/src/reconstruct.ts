import type { DataCache, GenerationConstraints, DecodedState } from "./index";
import { generateScheduleFromDecodedState, type ReconstructedPreview } from "./scheduleFromState";

/**
 * Reconstruct a schedule from decoded state for use in OG image preview.
 * Delegates to generateScheduleFromDecodedState which faithfully reimplements
 * the same pool-pick algorithm as the web app's generateSchedulesAction, and
 * returns the matching colour map (with swap colour-inheritance applied) so the
 * preview colours stay consistent with the live calendar.
 */
export function reconstructScheduleForPreview(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): ReconstructedPreview | null {
  return generateScheduleFromDecodedState(decoded, cache, constraints);
}
