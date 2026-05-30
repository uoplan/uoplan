import { describe, expect, it } from "vitest";

import { buildDataCache } from "../dataCache";
import type { Catalogue, ProgramRequirement, SchedulesData } from "../dataTypes";
import { resolveElectiveCandidates } from "../requirements/utils";

const catalogue: Catalogue = {
  courses: [
    { code: "PHI 1101", title: "Intro", credits: 3, description: "", component: "Lecture" },
    { code: "PHI 2101", title: "Mid", credits: 3, description: "", component: "Lecture" },
    { code: "PHI 3101", title: "Upper", credits: 3, description: "", component: "Lecture" },
    { code: "PHI 4101", title: "Senior", credits: 3, description: "", component: "Lecture" },
    { code: "HIS 3200", title: "History", credits: 3, description: "", component: "Lecture" },
    { code: "BIG 1000", title: "Big", credits: 6, description: "", component: "Lecture" },
  ],
  programs: [],
};

const schedules: SchedulesData = { termId: "2261", schedules: [] };

describe("resolveElectiveCandidates levels filtering", () => {
  const cache = buildDataCache(catalogue, schedules);

  it("returns all credit-eligible courses when no levels constraint", () => {
    const req: ProgramRequirement = { type: "elective", credits: 3 };
    const result = resolveElectiveCandidates(cache, req);
    expect(result.sort()).toEqual(["HIS 3200", "PHI 1101", "PHI 2101", "PHI 3101", "PHI 4101"]);
  });

  it("constrains the generic elective pool to the requested levels", () => {
    const req: ProgramRequirement = { type: "elective", credits: 3, levels: [3000, 4000] };
    const result = resolveElectiveCandidates(cache, req);
    expect(result.sort()).toEqual(["HIS 3200", "PHI 3101", "PHI 4101"]);
  });

  it("applies levels alongside the credit ceiling", () => {
    const req: ProgramRequirement = { type: "elective", credits: 3, levels: [1000] };
    const result = resolveElectiveCandidates(cache, req);
    // BIG 1000 is level 1000 but exceeds the 3-credit ceiling, so it is excluded.
    expect(result.sort()).toEqual(["PHI 1101"]);
  });
});
