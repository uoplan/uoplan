/**
 * Shared fixtures for golden / characterization tests of the schedule
 * generation pipeline.
 *
 * These tests freeze the CURRENT behaviour of `generateAdvancedSchedule` and
 * `generateBasicSchedule` so the upcoming rewrite (the new `engine` pipeline)
 * can be validated for parity of *course-set / pool semantics*.
 *
 * Intentionally we capture the chosen course SET, the pinned list, the
 * requirement-pool diagnostics and the optional pool — NOT the exact section /
 * time arrangement, because the deterministic section ordering is exactly the
 * bug the rewrite fixes.
 */
import { buildDataCache } from "../../../dataCache";
import type { DataCache } from "../../../dataCache";
import type {
  Catalogue,
  Course,
  CourseSchedule,
  ComponentSection,
  DayOfWeek,
  SchedulesData,
} from "../../../dataTypes";
import type { GenerationConstraints } from "../../types";
import type {
  AdvancedScheduleParams,
  AdvancedScheduleResult,
  BasicScheduleParams,
} from "../../../generateSchedule";

type TimeLite = { day: DayOfWeek; start: number; end: number };

export function makeSection(
  component: string,
  section: string,
  times: TimeLite[],
  opts: { virtual?: boolean; instructor?: string } = {},
): ComponentSection {
  return {
    section,
    sectionCode: section,
    component,
    session: null,
    status: null,
    times: times.map((t) => ({
      day: t.day,
      startMinutes: t.start,
      endMinutes: t.end,
      virtual: opts.virtual ?? false,
      instructor: opts.instructor ?? null,
    })),
  };
}

export function makeSchedule(
  courseCode: string,
  components: Record<string, ComponentSection[]>,
): CourseSchedule {
  const [subject, catalogNumber] = courseCode.split(/\s+/);
  return {
    subject,
    catalogNumber,
    courseCode,
    title: courseCode,
    timeZone: "America/Toronto",
    components,
  };
}

export function makeCourse(code: string, credits = 3): Course {
  return { code, title: code, credits, description: "" };
}

/**
 * A small but representative catalogue exercising: a core single-course
 * requirement, a discipline group requirement, a broad elective pool, a couple
 * of 1000-level courses (first-year credit cap), and an honours project.
 *
 * Every non-honours course has two LEC sections at distinct times so multiple
 * timetable arrangements exist.
 */
export function buildFixtureCache(): DataCache {
  const lec = (a: TimeLite[], b: TimeLite[]): Record<string, ComponentSection[]> => ({
    LEC: [makeSection("LEC", "A", a), makeSection("LEC", "B", b)],
  });

  const schedules: CourseSchedule[] = [
    makeSchedule(
      "CSI 2110",
      lec(
        [
          { day: "Mo", start: 600, end: 690 },
          { day: "We", start: 600, end: 690 },
        ],
        [
          { day: "Tu", start: 900, end: 990 },
          { day: "Th", start: 900, end: 990 },
        ],
      ),
    ),
    makeSchedule(
      "CSI 2120",
      lec([{ day: "Mo", start: 720, end: 810 }], [{ day: "We", start: 1020, end: 1110 }]),
    ),
    makeSchedule(
      "CSI 2101",
      lec([{ day: "Tu", start: 600, end: 690 }], [{ day: "Th", start: 720, end: 810 }]),
    ),
    makeSchedule(
      "SEG 2105",
      lec([{ day: "Fr", start: 600, end: 690 }], [{ day: "Mo", start: 1020, end: 1110 }]),
    ),
    makeSchedule(
      "MAT 1320",
      lec([{ day: "Tu", start: 720, end: 810 }], [{ day: "Th", start: 1020, end: 1110 }]),
    ),
    makeSchedule(
      "MAT 1322",
      lec([{ day: "We", start: 720, end: 810 }], [{ day: "Fr", start: 900, end: 990 }]),
    ),
    makeSchedule(
      "PHI 1101",
      lec([{ day: "Mo", start: 840, end: 930 }], [{ day: "We", start: 840, end: 930 }]),
    ),
    makeSchedule(
      "HIS 1100",
      lec([{ day: "Tu", start: 1020, end: 1110 }], [{ day: "Th", start: 600, end: 690 }]),
    ),
  ];

  const courses: Course[] = [
    makeCourse("CSI 2110"),
    makeCourse("CSI 2120"),
    makeCourse("CSI 2101"),
    makeCourse("SEG 2105"),
    makeCourse("MAT 1320"),
    makeCourse("MAT 1322"),
    makeCourse("PHI 1101"),
    makeCourse("HIS 1100"),
    // Honours project: code ending in 900, no schedule row (scheduled specially).
    makeCourse("CSI 4900", 6),
  ];

  const catalogue: Catalogue = { courses, programs: [] };
  const schedulesData: SchedulesData = { termId: "0000", schedules };
  return buildDataCache(catalogue, schedulesData);
}

export const DEFAULT_CONSTRAINTS: GenerationConstraints = {
  minStartMinutes: 0,
  maxEndMinutes: 24 * 60,
  allowedDays: [],
};

/**
 * A normalized, time-independent summary of a generation result used as the
 * golden snapshot. Section/time arrangement is intentionally excluded.
 */
export interface AdvancedGoldenSummary {
  courseSet: string[];
  pinned: string[];
  optionalPool: string[];
  emptyPoolLabels: string[];
  totalAvailable: number | null;
  totalNeeded: number | null;
  hasSchedule: boolean;
}

export function summarizeAdvanced(result: AdvancedScheduleResult): AdvancedGoldenSummary {
  return {
    courseSet: result.schedule ? result.schedule.enrollments.map((e) => e.courseCode).sort() : [],
    pinned: [...result.pinned].sort(),
    optionalPool: [...result.filteredOptionalPool].sort(),
    emptyPoolLabels: (result.poolDiagnostics?.emptyPools ?? []).map((p) => p.label).sort(),
    totalAvailable: result.poolDiagnostics?.totalAvailable ?? null,
    totalNeeded: result.poolDiagnostics?.totalNeeded ?? null,
    hasSchedule: result.schedule != null,
  };
}

/**
 * Base advanced params with empty selections; override per scenario. Pools are
 * passed via `remainingRequirements` to avoid needing the full requirements
 * computation in a unit fixture.
 */
export function baseAdvancedParams(cache: DataCache): AdvancedScheduleParams {
  return {
    cache,
    constraints: DEFAULT_CONSTRAINTS,
    completedCourses: [],
    prereqEligibleCourses: [],
    remainingRequirements: [],
    requirementTreeWithStatus: [],
    constrainedPerRequirementRaw: {},
    selectedPerRequirement: {},
    selectedOptionsPerRequirement: {},
    coursesThisSemester: 4,
    levelBuckets: ["undergrad"],
    languageBuckets: ["en", "fr", "other"],
    electiveLevelBuckets: [],
    includeClosedComponents: true,
    virtualSectionsOnly: false,
    generationPreferEasier: false,
    frenchImmersionStream: false,
    programTitle: undefined,
    blacklistedCourses: [],
    currentSeed: 1,
    firstSeed: 1,
  };
}

export function baseBasicParams(cache: DataCache): BasicScheduleParams {
  return {
    cache,
    constraints: DEFAULT_CONSTRAINTS,
    pinned: [],
    completedCourses: [],
    studentPrograms: [],
    levelBuckets: ["undergrad"],
    languageBuckets: ["en", "fr", "other"],
    electiveLevelBuckets: [],
    basicExcludedCategories: [],
    basicElectivesCount: 4,
    includeClosedComponents: true,
    virtualSectionsOnly: false,
    generationPreferEasier: false,
    frenchImmersionStream: false,
    programTitle: undefined,
    blacklistedCourses: [],
    currentSeed: 1,
    firstSeed: 1,
  };
}

/** All non-honours fixture course codes (useful as a prereq-eligible set). */
export const ALL_FIXTURE_CODES = [
  "CSI 2110",
  "CSI 2120",
  "CSI 2101",
  "SEG 2105",
  "MAT 1320",
  "MAT 1322",
  "PHI 1101",
  "HIS 1100",
  "CSI 4900",
];
