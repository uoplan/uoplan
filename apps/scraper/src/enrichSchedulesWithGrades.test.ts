import { describe, expect, it } from "vitest";
import {
  buildGradeLookups,
  enrichSchedulesPayload,
  type SchedulesFilePayload,
} from "./schedules/enrich.ts";

describe("buildGradeLookups", () => {
  it("keys distributions by course term and instructor name", () => {
    const lookups = buildGradeLookups([
      {
        code: "CSI 2110",
        professors: [
          {
            name: "Ada Lovelace",
            termId: 2251,
            section: "A00",
            distribution: { "A+": 2, F: 1 },
          },
          {
            name: "Ada Lovelace",
            termId: 2239,
            section: "B00",
            distribution: { "A+": 10 },
          },
        ],
      },
    ]);

    const fall2025 = lookups.byCourseTermName.get("CSI 2110")?.get(2251)?.get("ada lovelace");
    const fall2024 = lookups.byCourseTermName.get("CSI 2110")?.get(2239)?.get("ada lovelace");

    expect(fall2025).toEqual({ "A+": 2, F: 1 });
    expect(fall2024).toEqual({ "A+": 10 });
  });

  it("merges multiple sections in the same term for one instructor", () => {
    const lookups = buildGradeLookups([
      {
        code: "MAT 1341",
        professors: [
          {
            name: "Alan Turing",
            termId: 2251,
            section: "A00",
            distribution: { "A+": 1 },
          },
          {
            name: "Alan Turing",
            termId: 2251,
            section: "B00",
            distribution: { B: 2 },
          },
        ],
      },
    ]);

    const merged = lookups.byCourseTermName.get("MAT 1341")?.get(2251)?.get("alan turing");
    expect(merged).toEqual({ "A+": 1, B: 2 });
  });
});

describe("enrichSchedulesPayload", () => {
  it("matches grades for the schedules file term only", () => {
    const lookups = buildGradeLookups([
      {
        code: "CSI 2110",
        professors: [
          {
            name: "Grace Hopper",
            termId: 2251,
            distribution: { "A+": 5 },
          },
          {
            name: "Grace Hopper",
            termId: 2239,
            distribution: { F: 99 },
          },
        ],
      },
    ]);

    const data: SchedulesFilePayload = {
      termId: "2251",
      schedules: [
        {
          courseCode: "CSI 2110",
          components: {
            LEC: [{ times: [{ instructor: "Grace Hopper" }] }],
          },
        },
      ],
    };

    const stats = { sectionsTotal: 0, matched: 0, fallback: 0, none: 0 };
    enrichSchedulesPayload(data, lookups, stats);

    expect(data.schedules?.[0]?.components?.LEC?.[0]?.distribution).toEqual({ "A+": 5 });
    expect(stats.matched).toBe(1);
  });
});
