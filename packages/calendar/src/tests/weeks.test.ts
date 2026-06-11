import { describe, expect, it } from "vitest";
import { computeWeekGroups, slotActiveInWeek } from "../weeks";
import { makeSchedule } from "./fixtures";

describe("slotActiveInWeek", () => {
  it("checks the concrete weekday occurrence inside the requested week", () => {
    expect(slotActiveInWeek("Mo", ["2026-01-05", "2026-01-12"], "2026-01-12")).toBe(true);
    expect(slotActiveInWeek("Fr", ["2026-01-05", "2026-01-12"], "2026-01-12")).toBe(false);
  });
});

describe("computeWeekGroups", () => {
  it("groups consecutive weeks with identical active dated slots and picks the busiest group", () => {
    const schedule = makeSchedule([
      {
        courseCode: "CSI 2101",
        sections: [
          {
            component: "LEC",
            times: [
              {
                day: "Mo",
                startMinutes: 540,
                endMinutes: 600,
                meetingDates: ["2026-01-05", "2026-01-26"],
              },
            ],
          },
        ],
      },
      {
        courseCode: "MAT 1320",
        sections: [
          {
            component: "DGD",
            times: [
              {
                day: "We",
                startMinutes: 600,
                endMinutes: 720,
                meetingDates: ["2026-01-12", "2026-01-19"],
              },
            ],
          },
        ],
      },
    ]);

    expect(computeWeekGroups(schedule)).toEqual({
      groups: [
        { startDate: "2026-01-05", endDate: "2026-01-11" },
        { startDate: "2026-01-12", endDate: "2026-01-18" },
        { startDate: "2026-01-19", endDate: "2026-02-01" },
      ],
      busiestIndex: 1,
    });
  });

  it("returns no week groups when the schedule has no dated times", () => {
    const schedule = makeSchedule([
      {
        courseCode: "CSI 2101",
        sections: [
          {
            component: "LEC",
            times: [{ day: "Mo", startMinutes: 540, endMinutes: 600 }],
          },
        ],
      },
    ]);

    expect(computeWeekGroups(schedule)).toEqual({ groups: [], busiestIndex: 0 });
  });
});
