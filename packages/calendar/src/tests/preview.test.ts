import { describe, expect, it } from "vitest";
import { renderSchedulePreviewToSvg, scheduleToBusiestWeekEvents } from "../preview";
import { makeSchedule } from "./fixtures";

describe("scheduleToBusiestWeekEvents", () => {
  it("keeps undated events and dated events active in the busiest computed week", () => {
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
                endMinutes: 720,
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
      {
        courseCode: "PHY 1124",
        sections: [
          {
            component: "LAB",
            times: [{ day: "Tu", startMinutes: 780, endMinutes: 840 }],
          },
        ],
      },
    ]);

    expect(scheduleToBusiestWeekEvents(schedule).map((event) => event.courseCode)).toEqual([
      "CSI 2101",
      "MAT 1320",
      "PHY 1124",
    ]);
  });

  it("falls back to all events when no dated week groups can be computed", () => {
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

    expect(scheduleToBusiestWeekEvents(schedule).map((event) => event.courseCode)).toEqual([
      "CSI 2101",
    ]);
  });
});

describe("renderSchedulePreviewToSvg", () => {
  it("renders the busiest-week events into an SVG preview", () => {
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
                endMinutes: 720,
                meetingDates: ["2026-01-05", "2026-01-26"],
              },
            ],
          },
        ],
      },
    ]);

    const svg = renderSchedulePreviewToSvg(schedule, { "CSI 2101": 0 });

    expect(svg).toContain("<svg");
    expect(svg).toContain("CSI 2101");
    expect(svg).toContain("09:00–12:00");
  });
});
