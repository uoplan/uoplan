import { describe, expect, it } from "vitest";

import { buildDataCache } from "../dataCache";
import { unsafeBrand } from "../brand";
import type { FacultyId } from "../brand";
import type { Catalogue, DisciplinesData, ProgramRequirement, SchedulesData } from "../dataTypes";
import { resolveElectiveCandidates } from "../requirements/utils";
import { normalizeCourseCode } from "../utils/courseUtils";

const catalogue: Catalogue = {
  courses: [
    {
      code: normalizeCourseCode("PHI 1101"),
      title: "Intro",
      credits: 3,
      description: "",
      component: "Lecture",
    },
    {
      code: normalizeCourseCode("HIS 3200"),
      title: "History",
      credits: 3,
      description: "",
      component: "Lecture",
    },
    {
      code: normalizeCourseCode("MAT 1320"),
      title: "Calculus",
      credits: 3,
      description: "",
      component: "Lecture",
    },
    {
      code: normalizeCourseCode("CSI 2110"),
      title: "Algorithms",
      credits: 3,
      description: "",
      component: "Lecture",
    },
  ],
  programs: [],
};

const schedules: SchedulesData = { termId: "2261", schedules: [] };

const disciplinesData: DisciplinesData = {
  faculties: [
    { id: unsafeBrand<FacultyId>("arts"), name: "Faculty of Arts" },
    { id: unsafeBrand<FacultyId>("science"), name: "Faculty of Science" },
    { id: unsafeBrand<FacultyId>("engineering"), name: "Faculty of Engineering" },
  ],
  disciplines: [
    { code: "PHI", name: "Philosophy", facultyId: unsafeBrand<FacultyId>("arts") },
    { code: "HIS", name: "History", facultyId: unsafeBrand<FacultyId>("arts") },
    { code: "MAT", name: "Mathematics", facultyId: unsafeBrand<FacultyId>("science") },
    { code: "CSI", name: "Computer Science", facultyId: unsafeBrand<FacultyId>("engineering") },
  ],
};

describe("resolveElectiveCandidates faculty filtering", () => {
  const cache = buildDataCache(catalogue, schedules, disciplinesData);

  it("restricts a faculty_elective to courses in that faculty's disciplines", () => {
    const req: ProgramRequirement = {
      type: "faculty_elective",
      credits: 3,
      faculty: "Faculty of Arts",
    };
    expect(resolveElectiveCandidates(cache, req).sort()).toEqual([
      normalizeCourseCode("HIS 3200"),
      normalizeCourseCode("PHI 1101"),
    ]);
  });

  it("matches a faculty short form ('Science') to its disciplines", () => {
    const req: ProgramRequirement = { type: "faculty_elective", credits: 3, faculty: "Science" };
    expect(resolveElectiveCandidates(cache, req)).toEqual([normalizeCourseCode("MAT 1320")]);
  });

  it("falls back to the broad pool when the faculty is unresolvable", () => {
    const req: ProgramRequirement = {
      type: "faculty_elective",
      credits: 3,
      faculty: "Faculty of Nonexistent",
    };
    expect(resolveElectiveCandidates(cache, req).sort()).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("HIS 3200"),
      normalizeCourseCode("MAT 1320"),
      normalizeCourseCode("PHI 1101"),
    ]);
  });

  it("falls back to the broad pool when no disciplines data is loaded", () => {
    const bareCache = buildDataCache(catalogue, schedules);
    const req: ProgramRequirement = {
      type: "faculty_elective",
      credits: 3,
      faculty: "Faculty of Arts",
    };
    expect(resolveElectiveCandidates(bareCache, req)).toHaveLength(4);
  });
});
