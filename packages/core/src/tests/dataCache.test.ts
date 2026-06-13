import { describe, expect, it } from "vitest";
import {
  applyLatestAliasesToMergedCourses,
  buildDataCache,
  normalizeCourseCode,
  removeMergedCoursesSupersededByAliases,
} from "../dataCache";
import { unsafeBrand } from "../brand";
import type { FacultyId } from "../brand";
import type { Catalogue, SchedulesData } from "../dataTypes";

const minimalCatalogue: Catalogue = {
  courses: [
    {
      code: normalizeCourseCode("AMM 5101"),
      title: "Theory of Elasticity",
      credits: 3,
      description: "",
      component: "Lecture",
    },
    {
      code: normalizeCourseCode("AMM 5168"),
      title: "Industrial Organization",
      credits: 3,
      description: "",
      component: "Lecture",
    },
    {
      code: normalizeCourseCode("ENG 1100"),
      title: "Literature",
      credits: 3,
      description: "",
      component: "Lecture",
    },
    {
      code: normalizeCourseCode("ENG 2100"),
      title: "Writing",
      credits: 3,
      description: "",
      component: "Lecture",
    },
  ],
  programs: [],
};

const minimalSchedules: SchedulesData = {
  termId: "2261",
  schedules: [
    {
      subject: "AMM",
      catalogNumber: "5168",
      courseCode: normalizeCourseCode("AMM 5168"),
      title: "Industrial Organization",
      timeZone: "America/Toronto",
      components: {
        LEC: [
          {
            section: "M00-LEC",
            sectionCode: "M00",
            component: "LEC",
            session: null,
            times: [
              {
                day: "Tu",
                startMinutes: 510,
                endMinutes: 680,
                virtual: false,
                instructor: "Jamel-Eddine Cherbib",
                meetingDates: ["2026-01-12", "2026-04-15"] as [string, string],
              },
            ],
            status: "Open",
          },
        ],
      },
    },
  ],
};

describe("normalizeCourseCode", () => {
  it('normalizes normalizeCourseCode("AMM 5101") and normalizeCourseCode("AMM5101") to same key', () => {
    expect(normalizeCourseCode(normalizeCourseCode("AMM 5101"))).toBe(
      normalizeCourseCode("AMM 5101"),
    );
    expect(normalizeCourseCode(normalizeCourseCode("AMM5101"))).toBe(
      normalizeCourseCode("AMM 5101"),
    );
    expect(normalizeCourseCode("amm 5101")).toBe(normalizeCourseCode("AMM 5101"));
  });
});

describe("buildDataCache", () => {
  const cache = buildDataCache(minimalCatalogue, minimalSchedules);

  it('getCourse resolves both normalizeCourseCode("AMM 5101") and normalizeCourseCode("AMM5101") to same course', () => {
    const a = cache.getCourse(normalizeCourseCode("AMM 5101"));
    const b = cache.getCourse(normalizeCourseCode("AMM5101"));
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).toBe(b);
    expect(a?.code).toBe(normalizeCourseCode("AMM 5101"));
  });

  it("getSchedule returns schedule for scheduled course", () => {
    const s = cache.getSchedule(normalizeCourseCode("AMM 5168"));
    expect(s).toBeDefined();
    expect(s?.courseCode).toBe(normalizeCourseCode("AMM 5168"));
  });

  it("getSchedule returns undefined for non-scheduled course", () => {
    const s = cache.getSchedule(normalizeCourseCode("AMM 5101"));
    expect(s).toBeUndefined();
  });

  it("getCoursesByDiscipline returns only ENG-prefixed courses", () => {
    const eng = cache.getCoursesByDiscipline("ENG");
    expect(eng).toHaveLength(2);
    expect(eng.every((c) => c.code.startsWith("ENG"))).toBe(true);
  });

  it("getCoursesByDiscipline returns empty for unknown discipline", () => {
    const xyz = cache.getCoursesByDiscipline("XYZ");
    expect(xyz).toEqual([]);
  });
});

describe("buildDataCache faculty helpers", () => {
  const disciplinesData = {
    faculties: [
      { id: unsafeBrand<FacultyId>("engineering"), name: "Faculty of Engineering" },
      { id: unsafeBrand<FacultyId>("arts"), name: "Faculty of Arts", nameFr: "Faculté des arts" },
    ],
    disciplines: [
      { code: "AMM", name: "Advanced Materials", facultyId: unsafeBrand<FacultyId>("engineering") },
      { code: "ENG", name: "English", facultyId: unsafeBrand<FacultyId>("arts") },
    ],
  };
  const cache = buildDataCache(minimalCatalogue, minimalSchedules, disciplinesData);

  it("getFaculty resolves a known faculty id", () => {
    expect(cache.getFaculty("arts")?.name).toBe("Faculty of Arts");
    expect(cache.getFaculty("unknown")).toBeUndefined();
  });

  it("getFacultyForDiscipline maps a discipline code to its faculty", () => {
    expect(cache.getFacultyForDiscipline("ENG")?.id).toBe("arts");
    expect(cache.getFacultyForDiscipline("eng")?.id).toBe("arts");
    expect(cache.getFacultyForDiscipline("XYZ")).toBeUndefined();
  });

  it("getDisciplinesByFaculty lists the faculty's disciplines", () => {
    expect(cache.getDisciplinesByFaculty("engineering").map((d) => d.code)).toEqual(["AMM"]);
    expect(cache.getDisciplinesByFaculty("unknown")).toEqual([]);
  });

  it("getCoursesByFaculty flattens disciplines to their courses", () => {
    const eng = cache.getCoursesByFaculty("engineering");
    expect(eng.map((c) => c.code).sort()).toEqual([
      normalizeCourseCode("AMM 5101"),
      normalizeCourseCode("AMM 5168"),
    ]);
    const arts = cache.getCoursesByFaculty("arts");
    expect(arts.every((c) => c.code.startsWith("ENG"))).toBe(true);
  });

  it("faculty helpers degrade to empty without disciplines data", () => {
    const bare = buildDataCache(minimalCatalogue, minimalSchedules);
    expect(bare.getFaculty("arts")).toBeUndefined();
    expect(bare.getFacultyForDiscipline("ENG")).toBeUndefined();
    expect(bare.getCoursesByFaculty("engineering")).toEqual([]);
  });
});

describe("applyLatestAliasesToMergedCourses", () => {
  const latestSta = {
    code: normalizeCourseCode("STA 2100"),
    title: "Introduction to Statistics",
    credits: 3,
    description: "",
    aliases: [normalizeCourseCode("MAT 2375")],
  };
  const yearSta = {
    code: normalizeCourseCode("STA 2100"),
    title: "Introduction to Statistics",
    credits: 3,
    description: "",
  };

  it("copies aliases from the latest catalogue row onto merged course objects", () => {
    const merged = applyLatestAliasesToMergedCourses([latestSta], [yearSta]);
    expect(merged).toHaveLength(1);
    expect(merged[0].aliases).toEqual([normalizeCourseCode("MAT 2375")]);
  });

  it("leaves merged courses unchanged when latest has no aliases field", () => {
    const latestNoAlias = { ...latestSta };
    delete (latestNoAlias as { aliases?: string[] }).aliases;
    const merged = applyLatestAliasesToMergedCourses([latestNoAlias], [yearSta]);
    expect(merged[0].aliases).toBeUndefined();
  });
});

describe("removeMergedCoursesSupersededByAliases", () => {
  const latestSta = {
    code: normalizeCourseCode("STA 2100"),
    title: "Introduction to Statistics",
    credits: 3,
    description: "",
    aliases: [normalizeCourseCode("MAT 2375")],
  };
  const legacyMat = {
    code: normalizeCourseCode("MAT 2375"),
    title: "Old title",
    credits: 3,
    description: "",
  };

  it("drops merged rows whose code is only an alias on the latest catalogue", () => {
    const merged = [legacyMat, latestSta];
    const out = removeMergedCoursesSupersededByAliases([latestSta], merged);
    expect(out.map((c) => c.code)).toEqual([normalizeCourseCode("STA 2100")]);
  });

  it("keeps courses that are not listed as aliases on latest", () => {
    const other = {
      code: normalizeCourseCode("MAT 1341"),
      title: "Calculus",
      credits: 3,
      description: "",
    };
    const out = removeMergedCoursesSupersededByAliases([latestSta], [other, latestSta]);
    expect(out.map((c) => c.code).sort()).toEqual([
      normalizeCourseCode("MAT 1341"),
      normalizeCourseCode("STA 2100"),
    ]);
  });
});
