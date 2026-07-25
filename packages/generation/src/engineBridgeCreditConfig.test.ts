/**
 * Tests that `runTimetableFixedSet` forwards the correct `creditConfig` to the
 * engine proto request based on the `school` field in the input.
 *
 * The `buildTimetableRequest` function is internal; we verify it through
 * `runTimetableFixedSet` using a mock engine that captures the encoded bytes
 * and decodes them back to inspect the proto fields.
 */
import { describe, expect, it } from "vitest";
import { GenerationResponse, TimetableRequest } from "@uoplan/proto/engine";
import type { ScheduleEngine, TimetableFixedSetInput } from "./engineBridge";
import { runTimetableFixedSet } from "./engineBridge";
import type { DataCache } from "@uoplan/domain/dataCache";

// A minimal DataCache stub — `runTimetableFixedSet` only passes it to
// `mapTimetableResponse`, which is a no-op when `has_schedule` is false.
const EMPTY_CACHE = {} as DataCache;

const NO_OP_RESPONSE: Uint8Array = GenerationResponse.encode({
  hasSchedule: false,
  courses: [],
  optionalPool: [],
  pinned: [],
  chosenCourseToRequirement: {},
  poolDiagnostics: undefined,
  error: undefined,
}).finish();

/** Returns an engine that captures the timetable request bytes. */
function capturingEngine(): {
  engine: ScheduleEngine;
  getCaptured: () => TimetableRequest | null;
} {
  let captured: TimetableRequest | null = null;
  return {
    engine: {
      generate: () => NO_OP_RESPONSE,
      timetable_fixed_set: (bytes) => {
        captured = TimetableRequest.decode(bytes);
        return NO_OP_RESPONSE;
      },
    },
    getCaptured: () => captured,
  };
}

function minimalInput(overrides: Partial<TimetableFixedSetInput> = {}): TimetableFixedSetInput {
  return {
    courseCodes: ["COMP 1005"],
    constraints: { minStartMinutes: 0, maxEndMinutes: 1440 },
    seed: 1,
    includeClosedComponents: true,
    virtualSectionsOnly: false,
    optimizationPriorities: [],
    ...overrides,
  };
}

describe("buildTimetableRequest credit config", () => {
  it("defaults to uOttawa credit config when school is absent", () => {
    const { engine, getCaptured } = capturingEngine();
    runTimetableFixedSet(engine, minimalInput(), EMPTY_CACHE);
    const req = getCaptured();
    expect(req).not.toBeNull();
    // uOttawa: 3.0 credits per course
    expect(req!.creditConfig?.typicalCourseCredits).toBe(3);
    expect(req!.creditConfig?.defaultCourseCredits).toBe(3);
  });

  it("forwards Carleton credit config (0.5 per course) when school is 'carleton'", () => {
    const { engine, getCaptured } = capturingEngine();
    runTimetableFixedSet(engine, minimalInput({ school: "carleton" }), EMPTY_CACHE);
    const req = getCaptured();
    expect(req).not.toBeNull();
    expect(req!.creditConfig?.typicalCourseCredits).toBe(0.5);
    expect(req!.creditConfig?.defaultCourseCredits).toBe(0.5);
  });

  it("forwards uOttawa credit config (3.0 per course) when school is 'uottawa' explicitly", () => {
    const { engine, getCaptured } = capturingEngine();
    runTimetableFixedSet(engine, minimalInput({ school: "uottawa" }), EMPTY_CACHE);
    const req = getCaptured();
    expect(req).not.toBeNull();
    expect(req!.creditConfig?.typicalCourseCredits).toBe(3);
    expect(req!.creditConfig?.defaultCourseCredits).toBe(3);
  });
});
