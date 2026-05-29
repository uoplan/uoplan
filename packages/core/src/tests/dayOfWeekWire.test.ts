import { describe, expect, it } from "vitest";

import { DayOfWeek as DataDayOfWeek } from "@uoplan/proto/data";
import { DayOfWeek as StateDayOfWeek } from "@uoplan/proto/state";

import { DAY_OF_WEEK_CODES } from "../dataTypes";

/**
 * Golden wire mappings for day-of-week.
 *
 * The domain uses a single string-code representation (`DAY_OF_WEEK_CODES`),
 * but the two protobuf schemas encode days with different wire NUMBERS. Those
 * numbers are baked into committed `.pb` assets, share URLs, and the data the
 * Rust CLI reads, so they must never change. This test pins both numberings
 * and the canonical ordering so an accidental "unification" at the wire level
 * is caught immediately.
 */
describe("day-of-week wire contract", () => {
  it("uses a single canonical domain ordering", () => {
    expect(DAY_OF_WEEK_CODES).toStrictEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
  });

  it("pins data.proto DayOfWeek as 1-indexed (0 = unspecified)", () => {
    expect(DataDayOfWeek.DAY_OF_WEEK_UNSPECIFIED).toBe(0);
    expect(DataDayOfWeek.DAY_OF_WEEK_MO).toBe(1);
    expect(DataDayOfWeek.DAY_OF_WEEK_TU).toBe(2);
    expect(DataDayOfWeek.DAY_OF_WEEK_WE).toBe(3);
    expect(DataDayOfWeek.DAY_OF_WEEK_TH).toBe(4);
    expect(DataDayOfWeek.DAY_OF_WEEK_FR).toBe(5);
    expect(DataDayOfWeek.DAY_OF_WEEK_SA).toBe(6);
    expect(DataDayOfWeek.DAY_OF_WEEK_SU).toBe(7);
  });

  it("pins state.proto DayOfWeek as 0-indexed by canonical position", () => {
    expect(StateDayOfWeek.DAY_MONDAY).toBe(0);
    expect(StateDayOfWeek.DAY_TUESDAY).toBe(1);
    expect(StateDayOfWeek.DAY_WEDNESDAY).toBe(2);
    expect(StateDayOfWeek.DAY_THURSDAY).toBe(3);
    expect(StateDayOfWeek.DAY_FRIDAY).toBe(4);
    expect(StateDayOfWeek.DAY_SATURDAY).toBe(5);
    expect(StateDayOfWeek.DAY_SUNDAY).toBe(6);

    // state.proto numbers equal the canonical array index.
    expect(DAY_OF_WEEK_CODES.indexOf("Mo")).toBe(StateDayOfWeek.DAY_MONDAY);
    expect(DAY_OF_WEEK_CODES.indexOf("Su")).toBe(StateDayOfWeek.DAY_SUNDAY);

    // data.proto numbers equal the canonical array index + 1.
    expect(DAY_OF_WEEK_CODES.indexOf("Mo") + 1).toBe(DataDayOfWeek.DAY_OF_WEEK_MO);
    expect(DAY_OF_WEEK_CODES.indexOf("Su") + 1).toBe(DataDayOfWeek.DAY_OF_WEEK_SU);
  });
});
