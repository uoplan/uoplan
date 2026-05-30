/**
 * Regression test for the headline "schedules are not random" bug.
 *
 * Previously the timetabler always returned the first cartesian section/time
 * arrangement, so a given course set rendered with IDENTICAL times on every
 * seed. Advanced timetabling now flows through the seeded `engine`
 * enumerator, so different seeds surface different arrangements of the same
 * course set. This test pins a fixed course set and asserts the section choice
 * actually varies across seeds.
 */
import { describe, expect, it } from "vitest";
import { generateAdvancedSchedule } from "../../../generateSchedule";
import type { RemainingRequirement } from "../../../requirements";
import { ALL_FIXTURE_CODES, baseAdvancedParams, buildFixtureCache } from "./fixtures";
import type { GeneratedSchedule } from "../../types";

function req(
  requirementId: string,
  type: string,
  candidateCourses: string[],
  creditsNeeded: number,
  title?: string,
): RemainingRequirement {
  return { requirementId, type, title, candidateCourses, creditsNeeded, satisfiedBy: [] };
}

/** Order-independent fingerprint of the chosen sections (not just the courses). */
function sectionFingerprint(schedule: GeneratedSchedule): string {
  return schedule.enrollments
    .map((e) => {
      const sections = Object.keys(e.sectionCombo)
        .sort()
        .map((k) => `${k}:${e.sectionCombo[k].section.section}`)
        .join("|");
      return `${e.courseCode}{${sections}}`;
    })
    .sort()
    .join(",");
}

describe("advanced timetabling randomness", () => {
  it("varies the section arrangement of a fixed course set across seeds", () => {
    // Pin all four courses so the course SET is identical on every seed; only
    // the section/time arrangement is free to vary.
    const courses = ["CSI 2110", "MAT 1320", "PHI 1101", "HIS 1100"];

    const fingerprints = new Set<string>();
    const courseSets = new Set<string>();

    for (let seed = 1; seed <= 12; seed++) {
      const cache = buildFixtureCache();
      const params = baseAdvancedParams(cache);
      params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
      params.remainingRequirements = [req("req-core", "group", courses, 12, "Core")];
      params.constrainedPerRequirementRaw = { "req-core": courses };
      params.coursesThisSemester = 4;
      params.currentSeed = seed;
      params.firstSeed = seed;

      const result = generateAdvancedSchedule(params);
      expect(result.schedule).not.toBeNull();
      const schedule = result.schedule!;
      expect(schedule.enrollments).toHaveLength(4);
      courseSets.add(
        schedule.enrollments
          .map((e) => e.courseCode)
          .sort()
          .join(","),
      );
      fingerprints.add(sectionFingerprint(schedule));
    }

    // Same course set every time (the variable being controlled)...
    expect(courseSets.size).toBe(1);
    // ...but the section arrangement genuinely varies (the bug fix). The legacy
    // solver produced exactly ONE distinct arrangement here.
    expect(fingerprints.size).toBeGreaterThan(1);
  });
});
