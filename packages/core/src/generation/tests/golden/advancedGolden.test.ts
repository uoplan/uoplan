/**
 * Golden / characterization tests for `generateAdvancedSchedule`.
 *
 * These freeze the CURRENT course-set / pool semantics across a range of seeds
 * so the upcoming `engine` rewrite can be checked for parity. They assert
 * structural invariants (not exact section times, which the rewrite changes).
 */
import { describe, expect, it } from "vitest";
import { generateAdvancedSchedule } from "../../../generateSchedule";
import type { RemainingRequirement } from "../../../requirements";
import {
  ALL_FIXTURE_CODES,
  baseAdvancedParams,
  buildFixtureCache,
  summarizeAdvanced,
  type AdvancedGoldenSummary,
} from "./fixtures";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function req(
  requirementId: string,
  type: string,
  candidateCourses: string[],
  creditsNeeded: number,
  title?: string,
): RemainingRequirement {
  return { requirementId, type, title, candidateCourses, creditsNeeded, satisfiedBy: [] };
}

function runSeeds(build: () => ReturnType<typeof baseAdvancedParams>): AdvancedGoldenSummary[] {
  return SEEDS.map((seed) => {
    const params = build();
    params.currentSeed = seed;
    params.firstSeed = seed;
    return summarizeAdvanced(generateAdvancedSchedule(params));
  });
}

describe("generateAdvancedSchedule golden behaviour", () => {
  it("fills a group + elective pool across seeds (snapshot)", () => {
    const summaries = runSeeds(() => {
      const cache = buildFixtureCache();
      const params = baseAdvancedParams(cache);
      params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
      params.remainingRequirements = [
        req("req-csi", "group", ["CSI 2110", "CSI 2120", "CSI 2101"], 6, "CSI core"),
        req(
          "req-elec",
          "elective",
          ["PHI 1101", "HIS 1100", "MAT 1320", "MAT 1322"],
          6,
          "Electives",
        ),
      ];
      params.coursesThisSemester = 4;
      return params;
    });

    expect(summaries).toMatchSnapshot();
  });

  it("produces a full 4-course schedule and varies the course set across seeds", () => {
    const summaries = runSeeds(() => {
      const cache = buildFixtureCache();
      const params = baseAdvancedParams(cache);
      params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
      params.remainingRequirements = [
        req("req-csi", "group", ["CSI 2110", "CSI 2120", "CSI 2101"], 6, "CSI core"),
        req(
          "req-elec",
          "elective",
          ["PHI 1101", "HIS 1100", "MAT 1320", "MAT 1322"],
          6,
          "Electives",
        ),
      ];
      params.coursesThisSemester = 4;
      return params;
    });

    // Every seed should yield a complete 4-course schedule.
    for (const s of summaries) {
      expect(s.hasSchedule).toBe(true);
      expect(s.courseSet).toHaveLength(4);
    }

    // Documents the current (limited) variety: number of distinct course sets
    // produced across 8 seeds. The rewrite is expected to MATCH OR EXCEED this.
    const distinct = new Set(summaries.map((s) => s.courseSet.join(",")));
    expect(distinct.size).toMatchSnapshot("distinct-course-sets");
  });

  it("pins an explicitly constrained honours project (snapshot)", () => {
    const summaries = runSeeds(() => {
      const cache = buildFixtureCache();
      const params = baseAdvancedParams(cache);
      params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
      params.remainingRequirements = [
        req("req-hon", "course", ["CSI 4900"], 6, "Honours project"),
        req("req-csi", "group", ["CSI 2110", "CSI 2120", "CSI 2101"], 6, "CSI core"),
      ];
      params.constrainedPerRequirementRaw = { "req-hon": ["CSI 4900"] };
      params.coursesThisSemester = 3;
      return params;
    });

    expect(summaries).toMatchSnapshot();
    for (const s of summaries) {
      expect(s.pinned).toContain("CSI 4900");
    }
  });

  it("respects a group-token requirement (pick 2 CSI) (snapshot)", () => {
    const summaries = runSeeds(() => {
      const cache = buildFixtureCache();
      const params = baseAdvancedParams(cache);
      params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
      params.remainingRequirements = [
        req("req-csi", "group", ["CSI 2110", "CSI 2120", "CSI 2101"], 6, "CSI group"),
        req("req-elec", "elective", ["PHI 1101", "HIS 1100"], 6, "Electives"),
      ];
      params.constrainedPerRequirementRaw = { "req-csi": ["group:CSI", "group:CSI"] };
      params.coursesThisSemester = 4;
      return params;
    });

    expect(summaries).toMatchSnapshot();
  });

  it("excludes blacklisted courses from the general pool", () => {
    const summaries = runSeeds(() => {
      const cache = buildFixtureCache();
      const params = baseAdvancedParams(cache);
      params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
      params.remainingRequirements = [
        req(
          "req-elec",
          "elective",
          ["PHI 1101", "HIS 1100", "MAT 1320", "MAT 1322"],
          12,
          "Electives",
        ),
      ];
      params.blacklistedCourses = ["MAT 1320"];
      params.coursesThisSemester = 3;
      return params;
    });

    // The blacklist is a uniform course-scope exclusion: a blacklisted course
    // must never appear in a generated course set, whether picked from the
    // constrained (S) set or the general (G) pool.
    for (const summary of summaries) {
      expect(summary.courseSet).not.toContain("MAT 1320");
      expect(summary.optionalPool).not.toContain("MAT 1320");
    }
    expect(summaries).toMatchSnapshot();
  });

  it("enforces the first-year credit cap", () => {
    const summaries = runSeeds(() => {
      const cache = buildFixtureCache();
      const params = baseAdvancedParams(cache);
      params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
      params.remainingRequirements = [
        req(
          "req-elec",
          "elective",
          ["PHI 1101", "HIS 1100", "MAT 1320", "MAT 1322"],
          12,
          "Electives",
        ),
      ];
      // Allow at most one 1000-level (3-credit) course.
      params.constraints = { ...params.constraints, maxFirstYearCredits: 3 };
      params.coursesThisSemester = 3;
      return params;
    });

    for (const s of summaries) {
      if (!s.hasSchedule) continue;
      const firstYear = s.courseSet.filter((c) => {
        const m = c.match(/\d{4}/);
        return m != null && Number(m[0]) < 2000;
      });
      // 3-credit cap => at most one 1000-level course.
      expect(firstYear.length).toBeLessThanOrEqual(1);
    }
    expect(summaries).toMatchSnapshot();
  });
});
