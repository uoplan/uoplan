import type { CourseEnrollment } from "@uoplan/core";
import type { Catalogue, CourseSchedule, DayOfWeek, SchedulesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { DEFAULT_SCHEDULE_OPTIONS } from "@/lib/schedule-options";
import type { ScheduleVariant } from "@/lib/generate-schedule";
import {
  computeSwapOptions,
  filterSwapOptions,
  type SwapDataset,
  type SwapOption,
} from "@/lib/swap-course";

function makeSchedule(
  courseCode: string,
  times: { day: DayOfWeek; start: number; end: number }[],
): CourseSchedule {
  const [subject, catalogNumber] = courseCode.split(" ");
  return {
    subject,
    catalogNumber,
    courseCode: normalizeCourseCode(courseCode),
    title: null,
    timeZone: "America/Toronto",
    components: {
      LEC: [
        {
          section: "M00",
          sectionCode: "M00",
          component: "LEC",
          session: null,
          times: times.map((t) => ({
            day: t.day,
            startMinutes: t.start,
            endMinutes: t.end,
            virtual: false,
          })),
          status: null,
        },
      ],
    },
  };
}

function enrollment(
  courseCode: string,
  times: { day: DayOfWeek; start: number; end: number }[],
): CourseEnrollment {
  return {
    courseCode: normalizeCourseCode(courseCode),
    sectionCombo: {},
    times: times.map((t) => ({ day: t.day, startMinutes: t.start, endMinutes: t.end })),
  };
}

const catalogue: Catalogue = {
  courses: [
    { code: normalizeCourseCode("OLD 1000"), title: "Old", credits: 3, description: "" },
    { code: normalizeCourseCode("FIXED 1000"), title: "Fixed", credits: 3, description: "" },
    { code: normalizeCourseCode("FITS 2000"), title: "Fits Tuesday", credits: 3, description: "" },
    { code: normalizeCourseCode("CONFLICT 2000"), title: "Conflict", credits: 3, description: "" },
  ],
  programs: [],
};

const schedules: SchedulesData = {
  termId: "2261",
  schedules: [
    makeSchedule("OLD 1000", [{ day: "Mo", start: 540, end: 630 }]),
    makeSchedule("FIXED 1000", [{ day: "We", start: 720, end: 780 }]),
    makeSchedule("FITS 2000", [{ day: "Tu", start: 540, end: 630 }]),
    makeSchedule("CONFLICT 2000", [{ day: "We", start: 720, end: 780 }]),
  ],
};

const dataset: SwapDataset = {
  catalogue,
  disciplines: [],
  faculties: [],
  grades: null,
  ratings: null,
};

const variant: ScheduleVariant = {
  events: [],
  fingerprint: "x",
  courseCount: 2,
  schedule: {
    enrollments: [
      enrollment("OLD 1000", [{ day: "Mo", start: 540, end: 630 }]),
      enrollment("FIXED 1000", [{ day: "We", start: 720, end: 780 }]),
    ],
  },
};

describe("computeSwapOptions", () => {
  it("returns courses that fit the other enrollments and the matching enrollment index", () => {
    const result = computeSwapOptions({
      dataset,
      schedules,
      variant,
      courseCode: "OLD 1000",
      options: DEFAULT_SCHEDULE_OPTIONS,
      basketCodes: ["OLD 1000", "FIXED 1000"],
    });
    expect(result.enrollmentIndex).toBe(0);
    const codes = result.options.map((o) => o.code);
    expect(codes).toContain(normalizeCourseCode("FITS 2000"));
    expect(codes).not.toContain(normalizeCourseCode("CONFLICT 2000"));
    expect(codes).not.toContain(normalizeCourseCode("OLD 1000"));
    expect(codes).not.toContain(normalizeCourseCode("FIXED 1000"));
  });

  it("returns enrollmentIndex -1 and no options when the course isn't in the variant", () => {
    const result = computeSwapOptions({
      dataset,
      schedules,
      variant,
      courseCode: "NOT 9999",
      options: DEFAULT_SCHEDULE_OPTIONS,
      basketCodes: [],
    });
    expect(result).toEqual({ enrollmentIndex: -1, options: [] });
  });
});

describe("filterSwapOptions", () => {
  const opts: SwapOption[] = [
    option("AAA 1000", { title: "Alpha", avgRating: 3, aPlusPercent: 10, gpa: 9.5 }),
    option("BBB 2000", { title: "Beta", avgRating: 5, aPlusPercent: 40, gpa: 6 }),
    option("CCC 3000", { title: "Gamma", avgRating: 4, aPlusPercent: 20, gpa: 8 }),
  ];

  it("matches the query against code and title", () => {
    expect(filterSwapOptions(opts, { query: "beta", difficulty: null, sort: "best" })).toHaveLength(
      1,
    );
    expect(filterSwapOptions(opts, { query: "ccc", difficulty: null, sort: "best" })).toHaveLength(
      1,
    );
  });

  it("filters by difficulty bucket", () => {
    const easy = filterSwapOptions(opts, { query: "", difficulty: "easy", sort: "best" });
    expect(easy.map((o) => o.code)).toEqual([normalizeCourseCode("AAA 1000")]);
  });

  it("sorts by rating for 'best' and by A+ for 'aplus'", () => {
    expect(
      filterSwapOptions(opts, { query: "", difficulty: null, sort: "best" }).map((o) => o.code),
    ).toEqual([
      normalizeCourseCode("BBB 2000"),
      normalizeCourseCode("CCC 3000"),
      normalizeCourseCode("AAA 1000"),
    ]);
    expect(
      filterSwapOptions(opts, { query: "", difficulty: null, sort: "aplus" }).map((o) => o.code),
    ).toEqual([
      normalizeCourseCode("BBB 2000"),
      normalizeCourseCode("CCC 3000"),
      normalizeCourseCode("AAA 1000"),
    ]);
  });
});

function option(code: string, over: Partial<SwapOption>): SwapOption {
  const norm = normalizeCourseCode(code);
  return {
    code: norm,
    title: null,
    label: norm,
    aPlusPercent: null,
    avgRating: null,
    gpa: null,
    difficulty: null,
    gradeViz: null,
    sentiment: null,
    ...over,
  };
}
