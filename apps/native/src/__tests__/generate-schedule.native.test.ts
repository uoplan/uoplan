import type { Catalogue, DisciplinesData, SchedulesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { GenerationRequest, GenerationResponse, OptimizationKind } from "@uoplan/proto/engine";

import {
  createScheduleGenerator,
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

  it("emits each unique variant progressively via onVariant", async () => {
    const engine = cannedEngine();
    const onVariant = jest.fn();
    await generateScheduleVariants(baseInput({ engine, variantCount: 5, onVariant }));
    // The canned engine yields one unique arrangement, so onVariant fires once
    // (duplicate seeds are not re-emitted) with the running variant list.
    expect(onVariant).toHaveBeenCalledTimes(1);
    expect(onVariant.mock.calls[0]![0]).toHaveLength(1);
  });

  it("does not touch the engine when the signal is already aborted", async () => {
    const engine = cannedEngine();
    const controller = new AbortController();
    controller.abort();
    const { variants } = await generateScheduleVariants(
      baseInput({ engine, variantCount: 5, signal: controller.signal }),
    );
    expect(engine.generate).not.toHaveBeenCalled();
    expect(variants).toEqual([]);
  });

  it("stops issuing further seeds once the signal aborts mid-loop", async () => {
    // Each seed returns a distinct arrangement so every seed would otherwise add
    // a new unique variant; aborting after the first one must break the loop.
    let call = 0;
    const engine: EngineBridge = {
      loadDataset: jest.fn(async () => {}),
      generate: jest.fn(async () => {
        const section = `A0${call++}`;
        return GenerationResponse.encode({
          hasSchedule: true,
          courses: [{ courseCode: CODE, components: [{ component: "LEC", section }] }],
          optionalPool: [],
          pinned: [CODE],
          chosenCourseToRequirement: {},
        }).finish();
      }),
    };
    const controller = new AbortController();
    const { variants } = await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 8,
        signal: controller.signal,
        onVariant: () => controller.abort(),
      }),
    );
    // Aborting in the first onVariant breaks before the next seed runs: one
    // native call, one variant — not all 8.
    expect(engine.generate).toHaveBeenCalledTimes(1);
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
          basicElectivesCount: 2,
          basicExcludedCategories: ["PHI"],
          blacklistedCourses: ["MAT 1320"],
          levelBuckets: ["undergrad"],
          languageBuckets: ["en"],
          frenchImmersionStream: true,
          limitFirstYearCredits: true,
          optimizationPriorities: [
            { kind: "prefer_easier", enabled: true },
            { kind: "free_days", enabled: false },
            { kind: "good_breaks", enabled: false, breakCount: 1, breakTargetMinutes: 60 },
            { kind: "prefer_sentiment", enabled: false },
            { kind: "prefer_professor_rating", enabled: false },
          ],
          includeClosedComponents: true,
          virtualSectionsOnly: true,
        },
      }),
    );
    const sent = (engine.generate as jest.Mock).mock.calls[0]![0] as Uint8Array;
    const req = GenerationRequest.decode(sent);
    expect(req.constraints?.minStartMinutes).toBe(9 * 60);
    expect(req.constraints?.maxEndMinutes).toBe(17 * 60);
    // The ordered optimization priorities are forwarded verbatim (index 0 =
    // highest), and individual enabled flags are preserved.
    expect(req.optimizationPriorities.map((p) => p.kind)).toEqual([
      OptimizationKind.OPTIMIZATION_KIND_PREFER_EASIER,
      OptimizationKind.OPTIMIZATION_KIND_FREE_DAYS,
      OptimizationKind.OPTIMIZATION_KIND_GOOD_BREAKS,
      OptimizationKind.OPTIMIZATION_KIND_PREFER_SENTIMENT,
      OptimizationKind.OPTIMIZATION_KIND_PREFER_PROFESSOR_RATING,
    ]);
    expect(
      req.optimizationPriorities.find(
        (p) => p.kind === OptimizationKind.OPTIMIZATION_KIND_PREFER_EASIER,
      )?.enabled,
    ).toBe(true);
    // First-year limit on with no completed courses → full 48-credit budget.
    expect(req.constraints?.maxFirstYearCredits).toBe(48);
    // "Fr" → engine day index 4, full-day avoid window 8:30–22:00.
    expect(req.constraints?.blockedTimes).toEqual([
      { day: 4, startMinutes: 8 * 60 + 30, endMinutes: 22 * 60 },
      { day: 0, startMinutes: 11 * 60, endMinutes: 12 * 60 },
    ]);
    expect(req.includeClosedComponents).toBe(true);
    expect(req.virtualSectionsOnly).toBe(true);
    expect(req.electiveLevelBuckets).toEqual([1000, 2000, 5000]);
    expect(req.basicElectivesCount).toBe(2);
    expect(req.basicExcludedCategories).toEqual(["PHI"]);
    expect(req.blacklistedCourses).toEqual(["MAT 1320"]);
    expect(req.levelBuckets).toEqual(["undergrad"]);
    expect(req.languageBuckets).toEqual(["en"]);
    expect(req.frenchImmersionStream).toBe(true);
  });

  it("forwards the professor-rating ratings map when the objective is enabled", async () => {
    const engine = cannedEngine();
    await generateScheduleVariants(
      baseInput({
        engine,
        variantCount: 1,
        ratings: { "ada lovelace": { rating: 4.2, numRatings: 12 } },
        // prefer_professor_rating is enabled in the default priority list.
        options: { ...DEFAULT_SCHEDULE_OPTIONS },
      }),
    );
    const req = GenerationRequest.decode(
      (engine.generate as jest.Mock).mock.calls[0]![0] as Uint8Array,
    );
    expect(
      req.optimizationPriorities.find(
        (p) => p.kind === OptimizationKind.OPTIMIZATION_KIND_PREFER_PROFESSOR_RATING,
      )?.enabled,
    ).toBe(true);
    expect(req.professorRatings).toEqual({ "ada lovelace": 4.2 });
  });
});

/** A canned response pinning TST 1000's LEC to a specific section. */
function sectionResponse(section: string): Uint8Array {
  return GenerationResponse.encode({
    hasSchedule: true,
    courses: [{ courseCode: CODE, components: [{ component: "LEC", section }] }],
    optionalPool: [],
    pinned: [CODE],
    chosenCourseToRequirement: {},
  }).finish();
}

/** Two LEC sections (Mon A00 / Tue B00) so the engine can return two arrangements. */
function twoSectionSchedules(): SchedulesData {
  const base = buildSchedules();
  base.schedules[0]!.components.LEC!.push({
    section: "B00",
    sectionCode: "B00",
    component: "LEC",
    session: null,
    status: "Open",
    times: [
      {
        day: "Tu",
        startMinutes: 9 * 60,
        endMinutes: 10 * 60 + 30,
        virtual: false,
        instructor: "Ada Lovelace",
      },
    ],
  });
  return base;
}

/** Engine returning A00 on even calls and B00 on odd ones (two distinct variants). */
function alternatingEngine(): EngineBridge {
  let i = 0;
  return {
    loadDataset: jest.fn(async () => {}),
    generate: jest.fn(async () => sectionResponse(i++ % 2 === 0 ? "A00" : "B00")),
  };
}

describe("createScheduleGenerator", () => {
  it("yields the first variant lazily, then null once arrangements are exhausted", async () => {
    const engine = cannedEngine();
    const gen = await createScheduleGenerator(
      baseInput({ engine, catalogue: buildCatalogue(), schedules: buildSchedules() }),
    );
    expect(gen.skippedCourses).toEqual([]);
    const first = await gen.next();
    expect(first).not.toBeNull();
    expect(first!.events[0]!.courseCode).toBe(CODE);
    // The canned engine repeats one arrangement, so the next call dedups through
    // the miss budget and then reports exhaustion (null) permanently.
    expect(await gen.next()).toBeNull();
  });

  it("streams distinct arrangements across next() calls", async () => {
    const engine = alternatingEngine();
    const gen = await createScheduleGenerator(
      baseInput({ engine, catalogue: buildCatalogue(), schedules: twoSectionSchedules() }),
    );
    const a = await gen.next();
    const b = await gen.next();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.fingerprint).not.toBe(b!.fingerprint);
    // Only two distinct sections exist → the third call exhausts.
    expect(await gen.next()).toBeNull();
  });

  it("returns null without touching the engine for an empty basket", async () => {
    const engine = cannedEngine();
    const gen = await createScheduleGenerator(baseInput({ engine, basketCodes: [] }));
    expect(await gen.next()).toBeNull();
    expect(engine.generate).not.toHaveBeenCalled();
    expect(engine.loadDataset).not.toHaveBeenCalled();
  });

  it("stops yielding when the signal is aborted", async () => {
    const engine = cannedEngine();
    const gen = await createScheduleGenerator(
      baseInput({ engine, catalogue: buildCatalogue(), schedules: buildSchedules() }),
    );
    const controller = new AbortController();
    controller.abort();
    expect(await gen.next(controller.signal)).toBeNull();
  });
});
