import type { DataCache, GenerationConstraints, DecodedState } from "./index";
import type { ScheduleEngine } from "./engineBridge";
import {
  generateScheduleFromDecodedState,
  type ReconstructedPreview,
} from "./scheduleFromStateEngine";

/**
 * Reconstruct a schedule from decoded state for use in OG image preview.
 * Delegates to the shared Rust/WASM {@link ScheduleEngine} via
 * {@link generateScheduleFromDecodedState}, returning the matching colour map
 * (with swap colour-inheritance applied) so the preview colours stay consistent
 * with the live calendar.
 */
export function reconstructScheduleForPreview(
  engine: ScheduleEngine,
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): ReconstructedPreview | null {
  return generateScheduleFromDecodedState(engine, decoded, cache, constraints);
}
