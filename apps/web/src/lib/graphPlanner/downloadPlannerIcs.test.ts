import { describe, expect, test } from "vitest";
import type { GenerateSchedulesResult } from "../generateSchedulesAction";
import { canDownloadTerm } from "./downloadPlannerIcs";

/**
 * Build a minimal schedule bundle whose single meeting either carries a dated
 * range (downloadable) or not. Cast through `unknown` because the real
 * `GeneratedSchedule` shape is far larger than what `computeScheduleDateBounds`
 * actually reads (enrollments → sectionCombo → section.times → meetingDates).
 */
function bundle(meetingDates?: string[]): GenerateSchedulesResult {
  return {
    currentSchedule: {
      enrollments: [
        {
          sectionCombo: {
            LEC: { section: { times: [{ meetingDates }] } },
          },
        },
      ],
    },
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: null,
  } as unknown as GenerateSchedulesResult;
}

describe("canDownloadTerm", () => {
  test("is false without a bundle or schedule", () => {
    expect(canDownloadTerm()).toBe(false);
    expect(canDownloadTerm({ currentSchedule: null } as unknown as GenerateSchedulesResult)).toBe(
      false,
    );
  });

  test("is false when meetings carry no dated range", () => {
    expect(canDownloadTerm(bundle())).toBe(false);
    expect(canDownloadTerm(bundle([]))).toBe(false);
  });

  test("is true once a meeting has a start/end date pair", () => {
    expect(canDownloadTerm(bundle(["2025-01-06", "2025-04-04"]))).toBe(true);
  });
});
