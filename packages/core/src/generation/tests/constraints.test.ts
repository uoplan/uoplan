import { describe, expect, it } from "vitest";
import {
  timeSlotSatisfiesConstraints,
  satisfiesCompressedConstraint,
  timeSlotOverlapsBlocked,
} from "../constraints";
import type {
  BlockedTimeWindow,
  CourseEnrollment,
  GenerationConstraints,
  TimeSlot,
} from "../types";

describe("constraints", () => {
  it("timeSlotSatisfiesConstraints respects time bounds (day no longer constrained)", () => {
    const c: GenerationConstraints = {
      minStartMinutes: 480, // 8:00
      maxEndMinutes: 1020, // 17:00
    };

    const valid: TimeSlot = { day: "Mo", startMinutes: 500, endMinutes: 600 };
    expect(timeSlotSatisfiesConstraints(valid, c)).toBe(true);

    // Any weekday is allowed now; day avoidance is expressed via blockedTimes.
    const otherDay: TimeSlot = { day: "We", startMinutes: 500, endMinutes: 600 };
    expect(timeSlotSatisfiesConstraints(otherDay, c)).toBe(true);

    const tooEarly: TimeSlot = { day: "Mo", startMinutes: 400, endMinutes: 500 };
    expect(timeSlotSatisfiesConstraints(tooEarly, c)).toBe(false);

    const tooLate: TimeSlot = { day: "Mo", startMinutes: 1000, endMinutes: 1100 };
    expect(timeSlotSatisfiesConstraints(tooLate, c)).toBe(false);
  });

  it("timeSlotSatisfiesConstraints rejects slots overlapping a blocked window", () => {
    const blockedTimes: BlockedTimeWindow[] = [
      { day: "Mo", startMinutes: 600, endMinutes: 720 }, // 10:00 - 12:00
    ];
    const c: GenerationConstraints = {
      minStartMinutes: 480,
      maxEndMinutes: 1380,
      blockedTimes,
    };

    // Overlaps the block.
    expect(timeSlotSatisfiesConstraints({ day: "Mo", startMinutes: 660, endMinutes: 780 }, c)).toBe(
      false,
    );
    // Same time, different day: allowed.
    expect(timeSlotSatisfiesConstraints({ day: "Tu", startMinutes: 660, endMinutes: 780 }, c)).toBe(
      true,
    );
    // Touching the block end exactly: allowed (half-open).
    expect(timeSlotSatisfiesConstraints({ day: "Mo", startMinutes: 720, endMinutes: 800 }, c)).toBe(
      true,
    );
    // Touching the block start exactly: allowed.
    expect(timeSlotSatisfiesConstraints({ day: "Mo", startMinutes: 540, endMinutes: 600 }, c)).toBe(
      true,
    );
  });

  it("timeSlotOverlapsBlocked detects same-day strict overlap only", () => {
    const blocked: BlockedTimeWindow[] = [{ day: "We", startMinutes: 600, endMinutes: 700 }];
    expect(
      timeSlotOverlapsBlocked({ day: "We", startMinutes: 650, endMinutes: 660 }, blocked),
    ).toBe(true);
    expect(
      timeSlotOverlapsBlocked({ day: "Th", startMinutes: 650, endMinutes: 660 }, blocked),
    ).toBe(false);
    expect(
      timeSlotOverlapsBlocked({ day: "We", startMinutes: 700, endMinutes: 760 }, blocked),
    ).toBe(false);
  });

  it("satisfiesCompressedConstraint allows at most one gap <= 90 mins", () => {
    const validEnrollments: CourseEnrollment[] = [
      {
        courseCode: "A",
        sectionCombo: {},
        times: [
          { day: "Mo", startMinutes: 600, endMinutes: 690 }, // 10:00 - 11:30
          { day: "Mo", startMinutes: 720, endMinutes: 810 }, // 12:00 - 13:30 (30 min gap)
        ],
      },
    ];
    expect(satisfiesCompressedConstraint(validEnrollments)).toBe(true);

    const tooLongGap: CourseEnrollment[] = [
      {
        courseCode: "A",
        sectionCombo: {},
        times: [
          { day: "Mo", startMinutes: 600, endMinutes: 690 }, // 10:00 - 11:30
          { day: "Mo", startMinutes: 800, endMinutes: 890 }, // 13:20 - 14:50 (110 min gap)
        ],
      },
    ];
    expect(satisfiesCompressedConstraint(tooLongGap)).toBe(false);

    const tooManyGaps: CourseEnrollment[] = [
      {
        courseCode: "A",
        sectionCombo: {},
        times: [
          { day: "Mo", startMinutes: 600, endMinutes: 690 }, // 10:00 - 11:30
          { day: "Mo", startMinutes: 720, endMinutes: 810 }, // 12:00 - 13:30 (30 min gap)
          { day: "Mo", startMinutes: 840, endMinutes: 930 }, // 14:00 - 15:30 (30 min gap)
        ],
      },
    ];
    expect(satisfiesCompressedConstraint(tooManyGaps)).toBe(false);
  });
});
