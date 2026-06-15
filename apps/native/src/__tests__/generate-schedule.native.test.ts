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
    const variants = await generateScheduleVariants(baseInput({ basketCodes: [], engine }));
    expect(variants).toEqual([]);
    expect(engine.generate).not.toHaveBeenCalled();
  });

  it("loads the dataset once and maps a generated schedule to calendar events", async () => {
    const engine = cannedEngine();
    const variants = await generateScheduleVariants(
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
    const variants = await generateScheduleVariants(
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
          blockedTimes: [{ day: "Mo", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
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
      { day: 0, startMinutes: 10 * 60, endMinutes: 11 * 60 },
    ]);
    expect(req.includeClosedComponents).toBe(true);
    expect(req.virtualSectionsOnly).toBe(true);
    expect(req.generationPreferEasier).toBe(true);
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
