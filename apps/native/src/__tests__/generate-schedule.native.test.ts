import type { Catalogue, DisciplinesData, SchedulesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { GenerationRequest, GenerationResponse } from "@uoplan/proto/engine";

import {
  type EngineBridge,
  generateScheduleVariants,
  type GenerateScheduleInput,
} from "@/lib/generate-schedule";
import { DEFAULT_SCHEDULE_OPTIONS } from "@/lib/schedule-options";

const CODE = "TST 1000";
const norm = normalizeCourseCode(CODE);

function buildCatalogue(): Catalogue {
  return {
    courses: [
      {
        code: norm,
        title: "Intro to Testing",
        credits: 3,
        description: "",
      },
    ],
    programs: [],
  };
}

function buildSchedules(): SchedulesData {
  return {
    termId: "2261",
    schedules: [
      {
        subject: "TST",
        catalogNumber: "1000",
        courseCode: norm,
        title: "Intro to Testing",
        timeZone: "America/Toronto",
        components: {
          LEC: [
            {
              section: "A00",
              sectionCode: "A00",
              component: "LEC",
              session: null,
              status: "Open",
              times: [
                {
                  day: "Mo",
                  startMinutes: 9 * 60,
                  endMinutes: 10 * 60 + 30,
                  virtual: false,
                  instructor: "Ada Lovelace",
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

const DISCIPLINES: DisciplinesData = { disciplines: [], faculties: [] };

/** A canned engine that always returns the LEC A00 schedule for TST 1000. */
function cannedEngine(): EngineBridge {
  const response = GenerationResponse.encode({
    hasSchedule: true,
    courses: [{ courseCode: CODE, components: [{ component: "LEC", section: "A00" }] }],
    optionalPool: [],
    pinned: [CODE],
    chosenCourseToRequirement: {},
  }).finish();
  return {
    loadDataset: jest.fn(async () => {}),
    generate: jest.fn(async () => response),
  };
}

function baseInput(overrides: Partial<GenerateScheduleInput>): GenerateScheduleInput {
  return {
    datasetKey: "2261",
    catalogue: buildCatalogue(),
    schedules: buildSchedules(),
    disciplines: DISCIPLINES,
    ratings: null,
    basketCodes: [CODE],
    engine: cannedEngine(),
    ...overrides,
  };
}

describe("generateScheduleVariants", () => {
  it("returns no variants for an empty basket without touching the engine", async () => {
    const engine = cannedEngine();
    const { variants } = await generateScheduleVariants(baseInput({ basketCodes: [], engine }));
    expect(variants).toEqual([]);
    expect(engine.generate).not.toHaveBeenCalled();
  });

  it("loads the dataset once and maps a generated schedule to calendar events", async () => {
    const engine = cannedEngine();
    const { variants } = await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        catalogue: buildCatalogue(),
        schedules: buildSchedules(),
      }),
    );
    expect(engine.loadDataset).toHaveBeenCalledTimes(1);
    expect(variants).toHaveLength(1);
    expect(variants[0]!.courseCount).toBe(1);
    const event = variants[0]!.events[0]!;
    expect(event.courseCode).toBe(CODE);
    expect(event.day).toBe("Mo");
    expect(event.startMinutes).toBe(9 * 60);
    expect(event.componentSection).toContain("A00");
  });

  it("de-duplicates identical arrangements across seeds", async () => {
    const engine = cannedEngine();
    const { variants } = await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 5,
        catalogue: buildCatalogue(),
        schedules: buildSchedules(),
      }),
    );
    // The canned engine returns the same schedule for every seed → one variant.
    expect(engine.generate).toHaveBeenCalledTimes(5);
    expect(variants).toHaveLength(1);
  });

  it("skips basket courses with no schedulable section and reports them", async () => {
    const engine = cannedEngine();
    const CSI = normalizeCourseCode("CSI 2101");
    const catalogue: Catalogue = {
      courses: [
        { code: norm, title: "Intro to Testing", credits: 3, description: "" },
        { code: CSI, title: "Discrete Structures", credits: 3, description: "" },
      ],
      programs: [],
    };
    const { variants, skippedCourses } = await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        catalogue,
        // Only TST 1000 is offered this term; CSI 2101 has no schedule row.
        schedules: buildSchedules(),
        basketCodes: [CODE, "CSI 2101"],
      }),
    );
    // The unschedulable course is dropped (not a hard failure) and surfaced…
    expect(skippedCourses).toContainEqual({ code: CSI, reason: "offering" });
    // …while the rest of the basket still generates.
    expect(variants).toHaveLength(1);
    // The engine request pins ONLY the schedulable course.
    const req = GenerationRequest.decode(
      (engine.generate as jest.Mock).mock.calls[0]![0] as Uint8Array,
    );
    expect(req.basicPinnedCourses).toEqual([CODE]);
  });

  it("returns no variants but reports skips when every basket course is unschedulable", async () => {
    const engine = cannedEngine();
    const CSI = normalizeCourseCode("CSI 2101");
    const catalogue: Catalogue = {
      courses: [{ code: CSI, title: "Discrete Structures", credits: 3, description: "" }],
      programs: [],
    };
    const { variants, skippedCourses } = await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        catalogue,
        schedules: buildSchedules(),
        basketCodes: ["CSI 2101"],
      }),
    );
    // Nothing schedulable → engine never runs, but we still report the skip.
    expect(engine.generate).not.toHaveBeenCalled();
    expect(variants).toEqual([]);
    expect(skippedCourses).toEqual([{ code: CSI, reason: "offering" }]);
  });

  it("skips basket courses whose prerequisites aren't met and reports them", async () => {
    const engine = cannedEngine();
    const CSI = normalizeCourseCode("CSI 2101");
    const catalogue: Catalogue = {
      courses: [
        { code: norm, title: "Intro to Testing", credits: 3, description: "" },
        // CSI 2101 is offered this term but requires MAT 1348, which the student
        // hasn't completed, so it must be skipped.
        {
          code: CSI,
          title: "Discrete Structures",
          credits: 3,
          description: "",
          prerequisites: { type: "course", code: "MAT 1348" },
        },
      ],
      programs: [],
    };
    const schedules: SchedulesData = {
      termId: "2261",
      schedules: [
        ...buildSchedules().schedules,
        {
          subject: "CSI",
          catalogNumber: "2101",
          courseCode: CSI,
          title: "Discrete Structures",
          timeZone: "America/Toronto",
          components: {
            LEC: [
              {
                section: "A00",
                sectionCode: "A00",
                component: "LEC",
                session: null,
                status: "Open",
                times: [
                  {
                    day: "Tu",
                    startMinutes: 9 * 60,
                    endMinutes: 10 * 60 + 30,
                    virtual: false,
                    instructor: "Alan Turing",
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const { variants, skippedCourses } = await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        catalogue,
        schedules,
        basketCodes: [CODE, "CSI 2101"],
        hasProfileContext: true,
      }),
    );
    // CSI 2101 is offered but the prereq (MAT 1348) is unmet → skipped as prereq…
    expect(skippedCourses).toEqual([{ code: CSI, reason: "prerequisite" }]);
    // …while the rest of the basket still generates and pins only TST 1000.
    expect(variants).toHaveLength(1);
    const req = GenerationRequest.decode(
      (engine.generate as jest.Mock).mock.calls[0]![0] as Uint8Array,
    );
    expect(req.basicPinnedCourses).toEqual([CODE]);
  });

  it("does NOT skip a prereq course when the prerequisite is in the completed courses", async () => {
    const engine = cannedEngine();
    const CSI = normalizeCourseCode("CSI 2101");
    const MAT = normalizeCourseCode("MAT 1348");
    const catalogue: Catalogue = {
      courses: [
        {
          code: CSI,
          title: "Discrete Structures",
          credits: 3,
          description: "",
          prerequisites: { type: "course", code: "MAT 1348" },
        },
        { code: MAT, title: "Discrete Mathematics", credits: 3, description: "" },
      ],
      programs: [],
    };
    const schedules: SchedulesData = {
      termId: "2261",
      schedules: [
        {
          subject: "CSI",
          catalogNumber: "2101",
          courseCode: CSI,
          title: "Discrete Structures",
          timeZone: "America/Toronto",
          components: {
            LEC: [
              {
                section: "A00",
                sectionCode: "A00",
                component: "LEC",
                session: null,
                status: "Open",
                times: [
                  {
                    day: "Tu",
                    startMinutes: 9 * 60,
                    endMinutes: 10 * 60 + 30,
                    virtual: false,
                    instructor: "Alan Turing",
                  },
                ],
              },
            ],
          },
        },
        {
          subject: "MAT",
          catalogNumber: "1348",
          courseCode: MAT,
          title: "Discrete Mathematics",
          timeZone: "America/Toronto",
          components: {
            LEC: [
              {
                section: "A00",
                sectionCode: "A00",
                component: "LEC",
                session: null,
                status: "Open",
                times: [
                  {
                    day: "We",
                    startMinutes: 9 * 60,
                    endMinutes: 10 * 60 + 30,
                    virtual: false,
                    instructor: "Ada Lovelace",
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const { skippedCourses } = await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        catalogue,
        schedules,
        basketCodes: ["CSI 2101"],
        completedCourses: ["MAT 1348"],
        hasProfileContext: true,
      }),
    );
    // The completed-course set (MAT 1348) satisfies CSI 2101's prerequisite, so
    // CSI 2101 is NOT skipped even though MAT 1348 isn't in the generation cart.
    expect(skippedCourses).toEqual([]);
  });

  it("does NOT skip a prereq-unmet course when the user has no academic context", async () => {
    const engine = cannedEngine();
    const CSI = normalizeCourseCode("CSI 2101");
    const catalogue: Catalogue = {
      courses: [
        {
          code: CSI,
          title: "Discrete Structures",
          credits: 3,
          description: "",
          prerequisites: { type: "course", code: "MAT 1348" },
        },
      ],
      programs: [],
    };
    const schedules: SchedulesData = {
      termId: "2261",
      schedules: [
        {
          subject: "CSI",
          catalogNumber: "2101",
          courseCode: CSI,
          title: "Discrete Structures",
          timeZone: "America/Toronto",
          components: {
            LEC: [
              {
                section: "A00",
                sectionCode: "A00",
                component: "LEC",
                session: null,
                status: "Open",
                times: [
                  {
                    day: "Tu",
                    startMinutes: 9 * 60,
                    endMinutes: 10 * 60 + 30,
                    virtual: false,
                    instructor: "Alan Turing",
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    // No program / start year and no completed courses → we can't prove the
    // prereq is unmet, so it's NOT skipped (assume the user knows what they're
    // doing).
    const { skippedCourses } = await generateScheduleVariants(
      baseInput({ engine, variantCount: 1, catalogue, schedules, basketCodes: ["CSI 2101"] }),
    );
    expect(skippedCourses).toEqual([]);

    // …but once the planner has academic grounding (a program / year picked) the
    // same unmet prerequisite IS skipped.
    const { skippedCourses: skippedWithProfile } = await generateScheduleVariants(
      baseInput({
        engine: cannedEngine(),
        variantCount: 1,
        catalogue,
        schedules,
        basketCodes: ["CSI 2101"],
        hasProfileContext: true,
      }),
    );
    expect(skippedWithProfile).toEqual([{ code: CSI, reason: "prerequisite" }]);
  });

  it("threads generation options into the request constraints + filters", async () => {
    const engine = cannedEngine();
    await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        options: {
          ...DEFAULT_SCHEDULE_OPTIONS,
          minStartMinutes: 9 * 60,
          maxEndMinutes: 17 * 60,
          avoidedDays: ["Fr"],
          blockedTimes: [{ day: "Mo", startMinutes: 11 * 60, endMinutes: 12 * 60 }],
          electiveLevelBuckets: [1000, 2000, 5000],
          compressedSchedule: true,
          preferEasier: true,
          includeClosedComponents: true,
          virtualSectionsOnly: true,
        },
      }),
    );
    const sent = (engine.generate as jest.Mock).mock.calls[0]![0] as Uint8Array;
    const req = GenerationRequest.decode(sent);
    expect(req.constraints?.minStartMinutes).toBe(9 * 60);
    expect(req.constraints?.maxEndMinutes).toBe(17 * 60);
    expect(req.constraints?.compressedSchedule).toBe(true);
    // "Fr" → engine day index 4, full-day avoid window 8:30–22:00.
    expect(req.constraints?.blockedTimes).toEqual([
      { day: 4, startMinutes: 8 * 60 + 30, endMinutes: 22 * 60 },
      { day: 0, startMinutes: 11 * 60, endMinutes: 12 * 60 },
    ]);
    expect(req.includeClosedComponents).toBe(true);
    expect(req.virtualSectionsOnly).toBe(true);
    expect(req.generationPreferEasier).toBe(true);
    expect(req.electiveLevelBuckets).toEqual([1000, 2000, 5000]);
  });

  it("forwards the min professor rating + ratings map only when a minimum is set", async () => {
    const engine = cannedEngine();
    await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        ratings: { "ada lovelace": { rating: 4.2, numRatings: 12 } },
        options: { ...DEFAULT_SCHEDULE_OPTIONS, minProfessorRating: 3.5 },
      }),
    );
    const req = GenerationRequest.decode(
      (engine.generate as jest.Mock).mock.calls[0]![0] as Uint8Array,
    );
    expect(req.constraints?.minProfessorRating).toBeCloseTo(3.5);
    expect(req.professorRatings).toEqual({ "ada lovelace": 4.2 });
  });
});
