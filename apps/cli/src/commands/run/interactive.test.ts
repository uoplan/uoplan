import { describe, it, expect } from "vitest";
import { parseTorontoTime } from "./interactive.ts";

// All test cases target 2026-05-26 08:30 America/Toronto = 12:30 UTC (EDT = UTC-4)
const EXPECTED_UTC_MS = Date.UTC(2026, 4, 26, 12, 30); // May = index 4

describe("parseTorontoTime", () => {
  it('parses "May 26 8:30am"', () => {
    expect(parseTorontoTime("May 26 8:30am", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it('parses "May 26, 2026 8:30am"', () => {
    expect(parseTorontoTime("May 26, 2026 8:30am", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it('parses "may 26 08:30" (24h, lowercase)', () => {
    expect(parseTorontoTime("may 26 08:30", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it('parses "26/5 08:30"', () => {
    expect(parseTorontoTime("26/5 08:30", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it('parses "26/5/2026 08:30"', () => {
    expect(parseTorontoTime("26/5/2026 08:30", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it('parses "2026-05-26 08:30"', () => {
    expect(parseTorontoTime("2026-05-26 08:30", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it('parses "2026-05-26T08:30"', () => {
    expect(parseTorontoTime("2026-05-26T08:30", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it('strips a leading weekday name: "Monday May 26 8:30am"', () => {
    expect(parseTorontoTime("Monday May 26 8:30am", 2026)?.getTime()).toBe(EXPECTED_UTC_MS);
  });

  it("returns null for garbage input", () => {
    expect(parseTorontoTime("not a date", 2026)).toBeNull();
  });

  it("returns null when time is missing", () => {
    expect(parseTorontoTime("May 26", 2026)).toBeNull();
  });

  it('parses "May 26 12:00pm" as noon Toronto', () => {
    const expected = Date.UTC(2026, 4, 26, 16, 0); // 12:00 EDT = 16:00 UTC
    expect(parseTorontoTime("May 26 12:00pm", 2026)?.getTime()).toBe(expected);
  });

  it('parses "May 26 12:00am" as midnight Toronto', () => {
    const expected = Date.UTC(2026, 4, 26, 4, 0); // 00:00 EDT = 04:00 UTC
    expect(parseTorontoTime("May 26 12:00am", 2026)?.getTime()).toBe(expected);
  });
});
