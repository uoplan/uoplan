import { describe, expect, it } from "vitest";
import { createAppStore } from "../appStore";
import { createTestAppServices } from "../testServices";
import {
  DEFAULT_COURSES_THIS_SEMESTER,
  DEFAULT_GENERATION_MAX_END_MINUTES,
  DEFAULT_GENERATION_MIN_PROFESSOR_RATING,
  DEFAULT_GENERATION_MIN_START_MINUTES,
  DEFAULT_GENERATION_PREFER_EASIER,
  DEFAULT_GENERATION_PREFER_HIGHER_SENTIMENT,
} from "../generationDefaults";
import { avoidedDaysFromBlocks, defaultBlockedTimes } from "../blockedTimes";

describe("clearGenerationOptions", () => {
  it("resets generation options to defaults while preserving program/completed courses", () => {
    const store = createAppStore(createTestAppServices());
    store.setState({
      completedCourses: ["MAT 1320"],
      coursesThisSemester: 2,
      generationMinStartMinutes: 10 * 60,
      generationMaxEndMinutes: 16 * 60,
      blockedTimes: [{ id: "Mo-510-1320", day: "Mo", startMinutes: 510, endMinutes: 1320 }],
      generationMinProfessorRating: 4,
      generationLimitFirstYearCredits: false,
      generationCompressedSchedule: true,
      generationPreferEasier: false,
      generationPreferHigherSentiment: false,
      blacklistedCourses: ["CSI 2110"],
      includeClosedComponents: true,
      virtualSectionsOnly: true,
      constrainedPerRequirement: { req1: ["CSI 2101"] },
      currentSchedule: { enrollments: [] },
    });

    store.getState().clearGenerationOptions();
    const s = store.getState();

    expect(s.coursesThisSemester).toBe(DEFAULT_COURSES_THIS_SEMESTER);
    expect(s.generationMinStartMinutes).toBe(DEFAULT_GENERATION_MIN_START_MINUTES);
    expect(s.generationMaxEndMinutes).toBe(DEFAULT_GENERATION_MAX_END_MINUTES);
    expect(s.blockedTimes).toEqual(defaultBlockedTimes());
    expect(avoidedDaysFromBlocks(s.blockedTimes).sort()).toEqual(["Sa", "Su"]);
    expect(s.generationMinProfessorRating).toBe(DEFAULT_GENERATION_MIN_PROFESSOR_RATING);
    expect(s.generationLimitFirstYearCredits).toBe(true);
    expect(s.generationCompressedSchedule).toBe(false);
    expect(s.generationPreferEasier).toBe(DEFAULT_GENERATION_PREFER_EASIER);
    expect(s.generationPreferHigherSentiment).toBe(DEFAULT_GENERATION_PREFER_HIGHER_SENTIMENT);
    expect(s.blacklistedCourses).toEqual([]);
    expect(s.includeClosedComponents).toBe(false);
    expect(s.virtualSectionsOnly).toBe(false);
    expect(s.constrainedPerRequirement).toEqual({});
    expect(s.currentSchedule).toBeNull();

    // Generation options reset, but the user's term/program/completed-course context stays.
    expect(s.completedCourses).toEqual(["MAT 1320"]);
  });

  it("keeps 'fr' in the language buckets when the French immersion stream is on", () => {
    const store = createAppStore(createTestAppServices());
    store.setState({
      frenchImmersionStream: true,
      languageBuckets: ["en", "other", "fr"],
    });

    store.getState().clearGenerationOptions();

    expect(store.getState().languageBuckets).toContain("fr");
  });
});
