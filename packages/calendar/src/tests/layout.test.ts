import { describe, expect, it } from "vitest";
import {
  assignLanes,
  CAL_END_MINUTES,
  CAL_START_MINUTES,
  clampToCalendarRange,
  HALF_HOUR_PERCENTS,
  HOUR_LABELS,
  minutesToPercent,
  percentToMinutes,
  snapMinutes,
} from "../layout";
import type { CalendarEvent } from "../types";
import { makeEvent } from "./fixtures";

type LaneFixture = Pick<CalendarEvent, "id" | "startMinutes" | "endMinutes">;
type LaneExpectation = [id: string, laneIndex: number, laneCount: number];

function assignFixtureLanes(events: LaneFixture[]) {
  return assignLanes(events.map((event) => makeEvent(event)));
}

function partiallyOverlappingCluster(
  cEvent: Pick<LaneFixture, "startMinutes" | "endMinutes">,
): LaneFixture[] {
  return [
    { id: "a", startMinutes: 540, endMinutes: 600 },
    { id: "b", startMinutes: 570, endMinutes: 630 },
    { id: "c", ...cEvent },
  ];
}

function expectedPartialClusterLanes(cLaneCount: number): LaneExpectation[] {
  return [
    ["a", 0, 2],
    ["b", 1, 2],
    ["c", 0, cLaneCount],
  ];
}

describe("assignLanes", () => {
  it("sorts events by start time and gives non-overlapping events the full lane", () => {
    const early = makeEvent({ id: "early", startMinutes: 540, endMinutes: 600 });
    const late = makeEvent({ id: "late", startMinutes: 660, endMinutes: 720 });

    const laidOut = assignLanes([late, early]);

    expect(
      laidOut.map(({ event, laneIndex, laneCount }) => [event.id, laneIndex, laneCount]),
    ).toEqual([
      ["early", 0, 1],
      ["late", 0, 1],
    ]);
  });

  it("tiles fully overlapping events into separate lanes across the cluster", () => {
    const laidOut = assignLanes([
      makeEvent({ id: "a", startMinutes: 540, endMinutes: 660 }),
      makeEvent({ id: "b", startMinutes: 555, endMinutes: 645 }),
      makeEvent({ id: "c", startMinutes: 570, endMinutes: 630 }),
    ]);

    expect(
      laidOut.map(({ event, laneIndex, laneCount }) => [event.id, laneIndex, laneCount]),
    ).toEqual([
      ["a", 0, 3],
      ["b", 1, 3],
      ["c", 2, 3],
    ]);
  });

  it.each([
    [
      "reuses a lane inside a partially overlapping cluster without shrinking the cluster width",
      partiallyOverlappingCluster({ startMinutes: 600, endMinutes: 660 }),
      expectedPartialClusterLanes(2),
    ],
    [
      "starts a new one-lane cluster after a real gap",
      partiallyOverlappingCluster({ startMinutes: 660, endMinutes: 720 }),
      expectedPartialClusterLanes(1),
    ],
  ] as const)("%s", (_name, events, expected) => {
    const laidOut = assignFixtureLanes(events);

    expect(
      laidOut.map(({ event, laneIndex, laneCount }) => [event.id, laneIndex, laneCount]),
    ).toEqual(expected);
  });
});

describe("calendar minute helpers", () => {
  it("converts between minutes and vertical percentages without losing the original minute", () => {
    for (const minutes of [CAL_START_MINUTES, 600, 735, 1000, CAL_END_MINUTES]) {
      expect(percentToMinutes(minutesToPercent(minutes))).toBeCloseTo(minutes, 8);
    }
  });

  it("maps the visible calendar bounds to 0% and 100%", () => {
    expect(minutesToPercent(CAL_START_MINUTES)).toBe(0);
    expect(minutesToPercent(CAL_END_MINUTES)).toBe(100);
    expect(percentToMinutes(0)).toBe(CAL_START_MINUTES);
    expect(percentToMinutes(100)).toBe(CAL_END_MINUTES);
  });

  it("snaps to the nearest default or custom minute grid", () => {
    expect(snapMinutes(602)).toBe(600);
    expect(snapMinutes(603)).toBe(605);
    expect(snapMinutes(607, 15)).toBe(600);
    expect(snapMinutes(608, 15)).toBe(615);
  });

  it("clamps minutes to the visible calendar range", () => {
    expect(clampToCalendarRange(CAL_START_MINUTES - 1)).toBe(CAL_START_MINUTES);
    expect(clampToCalendarRange(CAL_END_MINUTES + 1)).toBe(CAL_END_MINUTES);
    expect(clampToCalendarRange(700)).toBe(700);
  });
});

describe("calendar grid constants", () => {
  it("provides hour labels for the visible hours before the lower boundary", () => {
    expect(HOUR_LABELS).toHaveLength(15);
    expect(HOUR_LABELS[0]).toEqual({ label: "08:00", percent: 0 });
    expect(HOUR_LABELS.at(-1)).toEqual({
      label: "22:00",
      percent: minutesToPercent(1320),
    });
  });

  it("provides half-hour divider positions between adjacent rendered hour labels", () => {
    expect(HALF_HOUR_PERCENTS).toHaveLength(HOUR_LABELS.length - 1);
    expect(HALF_HOUR_PERCENTS[0]).toBe(minutesToPercent(510));
    expect(HALF_HOUR_PERCENTS.at(-1)).toBe(minutesToPercent(1290));
    expect(HALF_HOUR_PERCENTS.every((percent) => percent > 0 && percent < 100)).toBe(true);
  });
});
