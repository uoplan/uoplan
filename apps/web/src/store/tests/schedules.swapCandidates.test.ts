import { beforeEach, describe, expect, it } from "vitest";
import { buildDataCache } from "@uoplan/core";
import { defaultAppStore } from "../appStore";
import {
  testCatalogue,
  testEnrollment,
  testMeetingTime,
  testSchedule,
  testSchedulesData,
} from "./scheduleTestHelpers";

describe("basic getSwapCandidates", () => {
  beforeEach(() => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      calendarMode: null,
      basicPinnedCourses: [],
      basicExcludedCategories: [],
      currentSchedule: null,
      cache: null,
      completedCourses: [],
      studentPrograms: [],
      levelBuckets: ["undergrad"],
      languageBuckets: ["en"],
      electiveLevelBuckets: [],
      generationMinStartMinutes: 0,
      generationMaxEndMinutes: 24 * 60,
      generationMinProfessorRating: null,
      professorRatings: null,
      includeClosedComponents: false,
      virtualSectionsOnly: false,
      blockedTimes: [],
    });
  });

  it("excludes candidates that cannot timetable with the remaining fixed courses", () => {
    const oldTime = testMeetingTime("Mo", 600, 660);
    const fixedTime = testMeetingTime("Mo", 540, 600);
    const conflictingTime = testMeetingTime("Mo", 540, 600);
    const fittingTime = testMeetingTime("Mo", 660, 720);
    const cache = buildDataCache(
      testCatalogue(["OLD 1100", "FIX 1100", "BAD 1100", "GOOD 1100"]),
      testSchedulesData([
        testSchedule("OLD 1100", oldTime),
        testSchedule("FIX 1100", fixedTime),
        testSchedule("BAD 1100", conflictingTime),
        testSchedule("GOOD 1100", fittingTime),
      ]),
    );

    defaultAppStore.setState({
      calendarMode: "basic",
      cache,
      catalogue: {
        courses: testCatalogue(["OLD 1100", "FIX 1100", "BAD 1100", "GOOD 1100"]).courses,
        programs: [],
      },
      schedulesData: testSchedulesData([
        testSchedule("OLD 1100", oldTime),
        testSchedule("FIX 1100", fixedTime),
        testSchedule("BAD 1100", conflictingTime),
        testSchedule("GOOD 1100", fittingTime),
      ]),
      currentSchedule: {
        enrollments: [testEnrollment("OLD 1100", oldTime), testEnrollment("FIX 1100", fixedTime)],
      },
    });

    const result = defaultAppStore.getState().getSwapCandidates(0);

    expect(result.candidates).toContain("GOOD 1100");
    expect(result.candidates).not.toContain("BAD 1100");
  });
});
