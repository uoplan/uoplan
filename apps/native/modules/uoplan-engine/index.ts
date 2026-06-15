import { requireOptionalNativeModule } from "expo";

/**
 * Bytes-in / bytes-out (protobuf `Uint8Array`) surface of the Rust
 * schedule-generation engine, linked natively via `UoplanEngine.xcframework`.
 * Mirrors the WASM `Engine` the web app + OG worker run, so results are
 * byte-for-byte identical.
 */
export interface UoplanEngineNativeModule {
  /** Build (or reuse) the engine for a dataset from encoded Catalogue + SchedulesData. */
  loadDataset(key: string, catalogue: Uint8Array, schedules: Uint8Array): Promise<boolean>;
  /** Generate a schedule from a serialized GenerationRequest → GenerationResponse. */
  generate(request: Uint8Array): Promise<Uint8Array>;
  /** Re-timetable a fixed set of courses from a serialized TimetableRequest. */
  timetableFixedSet(request: Uint8Array): Promise<Uint8Array>;
}

let cached: UoplanEngineNativeModule | null | undefined;

/**
 * Lazily resolve the registered native module. Returns `null` when the module is
 * unavailable (e.g. the JS-only jest environment, or a platform without the
 * binding), so callers can degrade gracefully instead of crashing at import time.
 */
export function getUoplanEngineModule(): UoplanEngineNativeModule | null {
  if (cached === undefined) {
    cached = requireOptionalNativeModule<UoplanEngineNativeModule>("UoplanEngine");
  }
  return cached ?? null;
}
