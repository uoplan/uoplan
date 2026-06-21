import type { Mock } from "vitest";
import { vi } from "vitest";
import { createAppStore } from "../appStore";
import { createTestAppServices } from "../testServices";
import type { AppStore } from "../types";
import {
  buildSwapCache,
  emptyScheduleGenerationResult,
  swapTimes,
  testEnrollment,
} from "./scheduleBuilders";

/**
 * Stand-in for the web schedule worker. The store invokes
 * `services.scheduleRunner.run(state, mode)`; tests configure this mock
 * (`mockResolvedValue` / `mockImplementation`) and assert on its calls.
 */
export const runScheduleGenerationMock: Mock = vi.fn();

export const testStore = createAppStore(
  createTestAppServices({
    scheduleRunner: {
      run: (state, mode) => runScheduleGenerationMock(state, mode),
    },
  }),
);

/** Reset the shared test store to a clean pre-seed state for navigation tests. */
export function resetStoreForSeedTests(firstSeed: number, overrides: Partial<AppStore> = {}) {
  runScheduleGenerationMock.mockReset();
  runScheduleGenerationMock.mockResolvedValue(emptyScheduleGenerationResult());
  testStore.setState({
    ...testStore.getState(),
    firstSeed,
    currentSeed: 0,
    lowestVisitedSeed: null,
    currentSchedule: null,
    scheduleGenerating: false,
    currentSwaps: [],
    ...overrides,
  });
}

export function resetSwapStore(calendarMode: "basic" | "advanced" = "basic") {
  const { monMorning, tueMorning } = swapTimes;
  testStore.setState({
    ...testStore.getState(),
    calendarMode,
    cache: buildSwapCache(),
    generationMinStartMinutes: 0,
    generationMaxEndMinutes: 24 * 60,
    generationPreferHigherProfessorRating: false,
    professorRatings: null,
    includeClosedComponents: true,
    virtualSectionsOnly: false,
    remainingRequirements: [],
    constrainedPerRequirement: {},
    selectedPerRequirement: {},
    blockedTimes: [],
    currentSchedule:
      calendarMode === "advanced"
        ? {
            enrollments: [
              testEnrollment("OLD 1100", monMorning),
              testEnrollment("FIX 1100", tueMorning),
            ],
          }
        : null,
    currentSeed: 7,
    currentSwaps: [],
    swapsPerSeed: {},
    chosenCourseToRequirementId: { "OLD 1100": "req-a" },
    currentPoolMap: { "OLD 1100": "req-a" },
    currentColorMap: { "OLD 1100": 0, "FIX 1100": 1 },
  });
}
