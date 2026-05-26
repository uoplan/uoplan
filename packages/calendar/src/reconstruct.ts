import type {
  DataCache,
  GeneratedSchedule,
  GenerationConstraints,
  DecodedState,
} from "@uoplan/schedule";
import { generateScheduleFromDecodedState } from "./scheduleFromState";

/**
 * Reconstruct a schedule from decoded state for use in OG image preview.
 * Delegates to generateScheduleFromDecodedState which faithfully reimplements
 * the same pool-pick algorithm as the web app's generateSchedulesAction.
 */
export function reconstructScheduleForPreview(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  return generateScheduleFromDecodedState(decoded, cache, constraints);
}
