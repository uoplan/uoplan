import {
  blockedTimesForScheduleOptions,
  avoidedDaysToBlockedTimes,
  DEFAULT_SCHEDULE_OPTIONS,
  formatTimeLabel,
  parseScheduleOptions,
  serializeScheduleOptions,
  type ScheduleOptions,
} from "@/lib/schedule-options";

describe("schedule-options", () => {
  describe("avoidedDaysToBlockedTimes", () => {
    it("maps each avoided day to a full-day 8:30–22:00 blocked window", () => {
      expect(avoidedDaysToBlockedTimes(["Sa", "Su"])).toEqual([
        { day: "Sa", startMinutes: 8 * 60 + 30, endMinutes: 22 * 60 },
        { day: "Su", startMinutes: 8 * 60 + 30, endMinutes: 22 * 60 },
      ]);
    });

    it("returns an empty list when no days are avoided", () => {
      expect(avoidedDaysToBlockedTimes([])).toEqual([]);
    });
  });

  describe("parseScheduleOptions", () => {
    it("returns defaults for malformed JSON", () => {
      expect(parseScheduleOptions("not json")).toEqual(DEFAULT_SCHEDULE_OPTIONS);
      expect(parseScheduleOptions("null")).toEqual(DEFAULT_SCHEDULE_OPTIONS);
      expect(parseScheduleOptions("[]")).toEqual(DEFAULT_SCHEDULE_OPTIONS);
    });

    it("round-trips a fully-specified options object", () => {
      const options: ScheduleOptions = {
        minStartMinutes: 9 * 60,
        maxEndMinutes: 18 * 60,
        avoidedDays: ["Fr"],
        blockedTimes: [{ day: "Mo", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
        optimizationPriorities: [
          { kind: "good_breaks", enabled: true, breakCount: 2, breakTargetMinutes: 90 },
          { kind: "free_days", enabled: true },
          { kind: "prefer_easier", enabled: false },
          { kind: "prefer_sentiment", enabled: true },
          { kind: "prefer_professor_rating", enabled: false },
        ],
        electiveLevelBuckets: [3000, 4000],
        coursesThisSemester: 4,
        additionalElectivesCount: 3,
        basicExcludedCategories: ["CSI", "MAT"],
        blacklistedCourses: ["PHI 1101"],
        levelBuckets: ["undergrad", "grad"],
        languageBuckets: ["en", "fr"],
        frenchImmersionStream: true,
        limitFirstYearCredits: false,
        includeClosedComponents: true,
        virtualSectionsOnly: true,
      };
      expect(parseScheduleOptions(serializeScheduleOptions(options))).toEqual(options);
    });

    it("defaults the new parity fields for old persisted options", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({ minStartMinutes: 9 * 60, maxEndMinutes: 18 * 60 }),
      );
      expect(parsed.additionalElectivesCount).toBe(0);
      expect(parsed.basicExcludedCategories).toEqual([]);
      expect(parsed.blacklistedCourses).toEqual([]);
      expect(parsed.levelBuckets).toEqual(["undergrad"]);
      expect(parsed.languageBuckets).toEqual(["en", "other"]);
      expect(parsed.frenchImmersionStream).toBe(false);
      expect(parsed.limitFirstYearCredits).toBe(true);
    });

    it("filters invalid level / language buckets and falls back when empty", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({
          levelBuckets: ["grad", "bogus", "grad"],
          languageBuckets: ["nope", 42],
        }),
      );
      expect(parsed.levelBuckets).toEqual(["grad"]);
      expect(parsed.languageBuckets).toEqual(["en", "other"]);
    });

    it("coerces a bogus elective count to a non-negative integer default", () => {
      expect(
        parseScheduleOptions(JSON.stringify({ additionalElectivesCount: -4 }))
          .additionalElectivesCount,
      ).toBe(0);
      expect(
        parseScheduleOptions(JSON.stringify({ additionalElectivesCount: 2.7 }))
          .additionalElectivesCount,
      ).toBe(3);
    });

    it("falls back per-field for partial / invalid data and drops bogus days", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({
          minStartMinutes: "oops",
          avoidedDays: ["Mo", "XX", 5],
          optimizationPriorities: "high",
        }),
      );
      expect(parsed.minStartMinutes).toBe(DEFAULT_SCHEDULE_OPTIONS.minStartMinutes);
      expect(parsed.avoidedDays).toEqual(["Mo"]);
      expect(parsed.blockedTimes).toEqual([]);
      expect(parsed.optimizationPriorities).toEqual(
        DEFAULT_SCHEDULE_OPTIONS.optimizationPriorities,
      );
      expect(parsed.electiveLevelBuckets).toEqual(DEFAULT_SCHEDULE_OPTIONS.electiveLevelBuckets);
    });

    it("defaults elective level buckets for old persisted options", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({
          minStartMinutes: 9 * 60,
          maxEndMinutes: 18 * 60,
        }),
      );

      expect(parsed.electiveLevelBuckets).toEqual([1000, 2000]);
    });

    it("filters persisted elective level buckets independently", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({
          electiveLevelBuckets: [2000, 2000, 5000, "bad", 9999],
        }),
      );

      expect(parsed.electiveLevelBuckets).toEqual([2000, 5000]);
    });

    it("defaults elective level buckets when persisted values are all invalid", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({
          electiveLevelBuckets: [0, 7000, "bad"],
        }),
      );

      expect(parsed.electiveLevelBuckets).toEqual(DEFAULT_SCHEDULE_OPTIONS.electiveLevelBuckets);
    });

    it("normalizes persisted blocked-time windows and drops malformed entries", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({
          blockedTimes: [
            { day: "We", startMinutes: 9 * 60, endMinutes: 10 * 60 },
            { day: "We", startMinutes: 10 * 60, endMinutes: 11 * 60 },
            { day: "XX", startMinutes: 9 * 60, endMinutes: 10 * 60 },
            { day: "Th", startMinutes: 12 * 60, endMinutes: 12 * 60 },
            { day: "Fr", startMinutes: "nope", endMinutes: 13 * 60 },
          ],
        }),
      );

      expect(parsed.blockedTimes).toEqual([
        { day: "We", startMinutes: 9 * 60, endMinutes: 11 * 60 },
      ]);
    });
  });

  describe("blockedTimesForScheduleOptions", () => {
    it("combines avoided days with custom blocked windows for generation", () => {
      expect(
        blockedTimesForScheduleOptions({
          ...DEFAULT_SCHEDULE_OPTIONS,
          avoidedDays: ["Fr"],
          blockedTimes: [{ day: "Mo", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
        }),
      ).toEqual([
        { day: "Fr", startMinutes: 8 * 60 + 30, endMinutes: 22 * 60 },
        { day: "Mo", startMinutes: 10 * 60, endMinutes: 11 * 60 },
      ]);
    });
  });

  describe("formatTimeLabel", () => {
    it("formats minutes-since-midnight as a 12-hour clock", () => {
      expect(formatTimeLabel(8 * 60 + 30)).toBe("8:30 AM");
      expect(formatTimeLabel(12 * 60)).toBe("12:00 PM");
      expect(formatTimeLabel(22 * 60)).toBe("10:00 PM");
      expect(formatTimeLabel(0)).toBe("12:00 AM");
    });
  });
});
