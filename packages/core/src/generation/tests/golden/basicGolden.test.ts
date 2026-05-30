/**
 * Golden / characterization tests for `generateBasicSchedule`.
 *
 * Basic mode fills `basicElectivesCount` slots from the whole catalogue subject
 * to bucket/exclusion/prereq filters. These freeze the current course-set
 * behaviour for parity checking by the rewrite.
 */
import { describe, expect, it } from "vitest";
import { generateBasicSchedule } from "../../../generateSchedule";
import { baseBasicParams, buildFixtureCache } from "./fixtures";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

interface BasicGoldenSummary {
  courseSet: string[];
  optionalPoolSize: number;
  hasSchedule: boolean;
}

function summarize(result: ReturnType<typeof generateBasicSchedule>): BasicGoldenSummary {
  return {
    courseSet: result.schedule ? result.schedule.enrollments.map((e) => e.courseCode).sort() : [],
    optionalPoolSize: result.optionalPool.length,
    hasSchedule: result.schedule != null,
  };
}

function runSeeds(build: () => ReturnType<typeof baseBasicParams>): BasicGoldenSummary[] {
  return SEEDS.map((seed) => {
    const params = build();
    params.currentSeed = seed;
    params.firstSeed = seed;
    return summarize(generateBasicSchedule(params));
  });
}

describe("generateBasicSchedule golden behaviour", () => {
  it("fills elective slots from the catalogue across seeds (snapshot)", () => {
    const summaries = runSeeds(() => {
      const params = baseBasicParams(buildFixtureCache());
      // No completed courses => only courses without prerequisites are eligible.
      // The fixture courses have none, so all are eligible.
      params.basicElectivesCount = 3;
      return params;
    });

    for (const s of summaries) {
      expect(s.hasSchedule).toBe(true);
      expect(s.courseSet).toHaveLength(3);
    }
    expect(summaries).toMatchSnapshot();
  });

  it("honours pinned courses and excluded categories", () => {
    const summaries = runSeeds(() => {
      const params = baseBasicParams(buildFixtureCache());
      params.pinned = ["CSI 2110"];
      params.basicExcludedCategories = ["HIS"];
      params.basicElectivesCount = 2;
      return params;
    });

    for (const s of summaries) {
      if (!s.hasSchedule) continue;
      expect(s.courseSet).toContain("CSI 2110");
      expect(s.courseSet).not.toContain("HIS 1100");
    }
    expect(summaries).toMatchSnapshot();
  });

  it("excludes blacklisted courses", () => {
    const summaries = runSeeds(() => {
      const params = baseBasicParams(buildFixtureCache());
      params.blacklistedCourses = ["PHI 1101"];
      params.basicElectivesCount = 3;
      return params;
    });

    for (const s of summaries) {
      expect(s.courseSet).not.toContain("PHI 1101");
    }
    expect(summaries).toMatchSnapshot();
  });
});
