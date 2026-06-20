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
        compressedSchedule: true,
        preferEasier: true,
        preferHigherSentiment: true,
        minProfessorRating: 4,
        electiveLevelBuckets: [3000, 4000],
        includeClosedComponents: true,
        virtualSectionsOnly: true,
      };
      expect(parseScheduleOptions(serializeScheduleOptions(options))).toEqual(options);
    });

    it("falls back per-field for partial / invalid data and drops bogus days", () => {
      const parsed = parseScheduleOptions(
        JSON.stringify({
          minStartMinutes: "oops",
          avoidedDays: ["Mo", "XX", 5],
          minProfessorRating: "high",
          compressedSchedule: 1,
        }),
      );
      expect(parsed.minStartMinutes).toBe(DEFAULT_SCHEDULE_OPTIONS.minStartMinutes);
      expect(parsed.avoidedDays).toEqual(["Mo"]);
      expect(parsed.blockedTimes).toEqual([]);
      expect(parsed.minProfessorRating).toBeNull();
      expect(parsed.compressedSchedule).toBe(false);
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
