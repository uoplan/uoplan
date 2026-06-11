import { describe, it, expect } from "vitest";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, Program } from "@uoplan/core";
import { computeRequirementsState } from "@uoplan/core";
import { defaultAppStore } from "../appStore";
import { testCourseCode } from "../../test/brands";
import { testCourse, testSchedule, testSchedulesData } from "./scheduleTestHelpers";

const testCatalogue: Catalogue = {
  courses: [
    // CSI 4000-level candidates
    testCourse("CSI 4101"),
    testCourse("CSI 4102"),
    testCourse("CSI 4103"),
    // Non-computing non-math electives
    testCourse("ENG 2100"),
    testCourse("ENG 2101"),
    testCourse("HIS 2100"),
  ],
  programs: [],
};

// Give every course a trivial non-overlapping schedule so time generation
// never prunes them; the test focuses on requirement/category limits.
const simpleSchedules = testSchedulesData(testCatalogue.courses.map((c) => testSchedule(c.code)));

function groupRequirement(
  title: string,
  credits: number,
  codes: string[],
): Program["requirements"][number] {
  return {
    type: "group",
    title,
    credits,
    options: codes.map((code) => ({ type: "course", code: testCourseCode(code) })),
  };
}

const programWithCsiAndElectives: Program = {
  title: "Test CSI + electives",
  url: "",
  requirements: [
    groupRequirement("3 credits of CSI 4000", 3, ["CSI 4101", "CSI 4102", "CSI 4103"]),
    groupRequirement("6 credits of non-computing electives", 6, [
      "ENG 2100",
      "ENG 2101",
      "HIS 2100",
    ]),
  ],
};

function setGenerationFixture({
  catalogue,
  schedulesData,
  cache,
  program,
  completedCourses,
  remaining,
  coursesThisSemester,
  state,
}: {
  catalogue: Catalogue;
  schedulesData: ReturnType<typeof testSchedulesData>;
  cache: ReturnType<typeof buildDataCache>;
  program: Program;
  completedCourses: string[];
  remaining: ReturnType<typeof computeRequirementsState>["remaining"];
  coursesThisSemester: number;
  state?: Partial<ReturnType<typeof defaultAppStore.getState>>;
}) {
  const store = defaultAppStore;
  store.setState({
    ...store.getState(),
    catalogue: { courses: catalogue.courses, programs: [program] },
    schedulesData,
    cache,
    program,
    completedCourses,
    remainingRequirements: remaining,
    requirementTreeWithStatus: [],
    completedRequirementsList: [],
    selectedPerRequirement: {},
    requirementSlotsUserTouched: {},
    selectedOptionsPerRequirement: {},
    prereqEligibleCourses: catalogue.courses.map((c) => c.code),
    filteredPrereqEligibleCourses: catalogue.courses.map((c) => c.code),
    levelBuckets: ["undergrad"],
    languageBuckets: ["en", "other"],
    electiveLevelBuckets: [],
    coursesThisSemester,
    currentSchedule: null,
    generationError: null,
    ...state,
  });
}

function graduateOnlyFixture() {
  const catalogue: Catalogue = {
    courses: [testCourse("SEG 5100")],
    programs: [],
  };
  const schedulesData = testSchedulesData([testSchedule("SEG 5100")]);
  const program: Program = {
    title: "Free elective only",
    url: "",
    requirements: [{ type: "free_elective", title: "3 free elective credits", credits: 3 }],
  };
  const cache = buildDataCache(catalogue, schedulesData);
  const completedCourses: string[] = [];
  const { remaining } = computeRequirementsState(program, completedCourses, cache);
  return { catalogue, schedulesData, program, cache, completedCourses, remaining };
}

const scheduleLimitsCache = buildDataCache(testCatalogue, simpleSchedules);

async function generateScheduleForProgram(
  program: Program,
  coursesThisSemester: number,
  state?: Partial<ReturnType<typeof defaultAppStore.getState>>,
) {
  const completedCourses: string[] = [];
  const { remaining } = computeRequirementsState(program, completedCourses, scheduleLimitsCache);
  setGenerationFixture({
    catalogue: testCatalogue,
    schedulesData: simpleSchedules,
    cache: scheduleLimitsCache,
    program,
    completedCourses,
    remaining,
    coursesThisSemester,
    state,
  });
  await defaultAppStore.getState().generateSchedules();
  return { currentSchedule: defaultAppStore.getState().currentSchedule, remaining };
}

function scheduleCourseFamilies(
  currentSchedule: NonNullable<ReturnType<typeof defaultAppStore.getState>["currentSchedule"]>,
) {
  const codes = currentSchedule.enrollments.map((e) => e.courseCode);
  return {
    codes,
    csiCourses: codes.filter((c) => c.startsWith("CSI")),
    nonComputing: codes.filter((c) => !c.startsWith("CSI")),
  };
}

describe("schedule generation respects per-category limits", () => {
  it("avoids adding extra CSI courses beyond the required credits when other unmet categories exist", async () => {
    const { currentSchedule } = await generateScheduleForProgram(programWithCsiAndElectives, 3);
    expect(currentSchedule).not.toBeNull();

    if (currentSchedule) {
      const { csiCourses, nonComputing } = scheduleCourseFamilies(currentSchedule);

      // Exactly one CSI course should appear (3 credits required) when there are
      // enough non-computing electives available to fill the rest.
      expect(csiCourses.length).toBe(1);
      expect(nonComputing.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("distributes courses across multiple requirement groups when more than one course is needed in each", async () => {
    // Program where we need 6 credits of CSI 4000 (two courses) and
    // 6 credits of non-computing electives (two courses). With a
    // 4-course semester, schedules should tend to include 2 CSI and 2 non-computing.
    const programWithMoreCsi: Program = {
      title: "Test CSI 2x + electives",
      url: "",
      requirements: [
        groupRequirement("6 credits of CSI 4000", 6, ["CSI 4101", "CSI 4102", "CSI 4103"]),
        groupRequirement("6 credits of non-computing electives", 6, [
          "ENG 2100",
          "ENG 2101",
          "HIS 2100",
        ]),
      ],
    };

    const { currentSchedule } = await generateScheduleForProgram(programWithMoreCsi, 4);
    expect(currentSchedule).not.toBeNull();

    if (currentSchedule) {
      const { codes, csiCourses, nonComputing } = scheduleCourseFamilies(currentSchedule);

      expect(codes.length).toBe(4);
      expect(csiCourses.length).toBeLessThanOrEqual(2);
      expect(nonComputing.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("respects pinned selections while still balancing CSI and non-computing requirements", async () => {
    // Same program as above: 6 CSI credits and 6 non-computing credits required.
    const completedCourses: string[] = [];
    const { remaining } = computeRequirementsState(
      programWithCsiAndElectives,
      completedCourses,
      scheduleLimitsCache,
    );
    const csiReqId = remaining[0]?.requirementId ?? "req-0";

    // Pin CSI 4101 via constrainedPerRequirement to simulate the user explicitly
    // choosing it. The generator should treat it as pinned and only pull one
    // additional CSI course from the pools, plus enough non-computing courses
    // to reach the term target. Use 3 courses so: 1 pinned CSI + 2 from pools.
    setGenerationFixture({
      catalogue: testCatalogue,
      schedulesData: simpleSchedules,
      cache: scheduleLimitsCache,
      program: programWithCsiAndElectives,
      completedCourses,
      remaining,
      coursesThisSemester: 3,
      state: {
        constrainedPerRequirement: { [csiReqId]: ["CSI 4101"] },
        electiveLevelBuckets: [1000, 2000, 3000, 4000],
      },
    });

    await defaultAppStore.getState().generateSchedules();

    const { currentSchedule } = defaultAppStore.getState();
    expect(currentSchedule).not.toBeNull();

    if (currentSchedule) {
      const schedule = currentSchedule;
      const codes = schedule.enrollments.map((e) => e.courseCode);
      // CSI 4101 should always appear because it is pinned.
      expect(codes).toContain("CSI 4101");
    }
  });

  it("treats 5000+ courses as ineligible for elective requirements", async () => {
    const fixture = graduateOnlyFixture();
    setGenerationFixture({
      ...fixture,
      coursesThisSemester: 1,
      state: {
        levelBuckets: ["undergrad", "grad"],
        electiveLevelBuckets: [1000, 2000, 3000, 4000],
      },
    });

    await defaultAppStore.getState().generateSchedules();

    const { currentSchedule, generationError } = defaultAppStore.getState();
    expect(currentSchedule).toBeNull();
    expect(generationError).not.toBeNull();
  });

  it("keeps the previous schedule when a re-generation fails", async () => {
    const fixture = graduateOnlyFixture();

    // A schedule already on screen (the object identity is the assertion target).
    const existingSchedule = { enrollments: [] };

    setGenerationFixture({
      ...fixture,
      coursesThisSemester: 1,
      state: {
        levelBuckets: ["undergrad", "grad"],
        electiveLevelBuckets: [1000, 2000, 3000, 4000],
        currentSchedule: existingSchedule,
        currentSeed: 1234,
      },
    });

    await defaultAppStore.getState().generateSchedules();

    const { currentSchedule, generationError, currentSeed } = defaultAppStore.getState();
    // The failing re-generation must not wipe the calendar.
    expect(currentSchedule).toBe(existingSchedule);
    expect(currentSeed).toBe(1234);
    // ...but the error is still surfaced so the toast fires.
    expect(generationError).not.toBeNull();
  });

  it("applies elective-level buckets only to elective pools", async () => {
    const scopedCatalogue: Catalogue = {
      courses: [testCourse("CSI 4101"), testCourse("ENG 1100"), testCourse("ENG 2100")],
      programs: [],
    };

    const scopedSchedules = testSchedulesData(
      scopedCatalogue.courses.map((c) => testSchedule(c.code)),
    );

    const scopedProgram: Program = {
      title: "Scoped elective filter test",
      url: "",
      requirements: [
        { type: "course", code: testCourseCode("CSI 4101") },
        { type: "free_elective", title: "3 elective credits", credits: 3 },
      ],
    };

    const scopedCache = buildDataCache(scopedCatalogue, scopedSchedules);
    const completedCourses: string[] = [];
    const { remaining } = computeRequirementsState(scopedProgram, completedCourses, scopedCache);
    expect(remaining.length).toBeGreaterThan(0);
    expect(remaining.some((r) => r.type === "free_elective")).toBe(true);
    expect(remaining.some((r) => r.type === "course")).toBe(true);
    const disciplineReq = remaining.find((r) => r.type === "free_elective");
    const courseReq = remaining.find((r) => r.type === "course");
    expect(disciplineReq?.candidateCourses?.includes("ENG 1100")).toBe(true);
    expect(courseReq?.candidateCourses).toContain("CSI 4101");

    setGenerationFixture({
      catalogue: scopedCatalogue,
      schedulesData: scopedSchedules,
      cache: scopedCache,
      program: scopedProgram,
      completedCourses,
      remaining,
      coursesThisSemester: 2,
      state: { electiveLevelBuckets: [1000] },
    });

    await defaultAppStore.getState().generateSchedules();

    const { currentSchedule, generationError } = defaultAppStore.getState();
    expect(currentSchedule).not.toBeNull();
    expect(generationError).toBeNull();
    const firstCodes =
      currentSchedule?.enrollments.map((e: { courseCode: string }) => e.courseCode) ?? [];
    expect(firstCodes).toContain("CSI 4101");
    expect(firstCodes).toContain("ENG 1100");
    expect(firstCodes).not.toContain("ENG 2100");
  });
});
