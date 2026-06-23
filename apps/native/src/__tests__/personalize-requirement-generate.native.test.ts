import type { Catalogue, DisciplinesData, SchedulesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { GenerationRequest, GenerationResponse } from "@uoplan/proto/engine";

import {
  type EngineBridge,
  generateScheduleVariants,
  type GenerateScheduleInput,
} from "@/lib/generate-schedule";
import { DEFAULT_REQUIREMENT_SELECTIONS } from "@/lib/personalize-requirements";

const PROGRAM_URL = "https://example.com/advanced-program";
const CODE = "CSI 2110";
const norm = normalizeCourseCode(CODE);

function buildCatalogue(): Catalogue {
  return {
    courses: [
      {
        code: norm,
        title: "Data structures",
        credits: 3,
        description: "",
      },
    ],
    programs: [
      {
        title: "Advanced program",
        url: PROGRAM_URL,
        requirements: [
          {
            type: "course",
            code: norm,
            credits: 3,
          },
        ],
      },
    ],
  };
}

function buildSchedules(): SchedulesData {
  return {
    termId: "2261",
    schedules: [
      {
        subject: "CSI",
        catalogNumber: "2110",
        courseCode: norm,
        title: "Data structures",
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
                  endMinutes: 10 * 60,
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

function recordingEngine(): EngineBridge {
  const response = GenerationResponse.encode({
    hasSchedule: true,
    courses: [{ courseCode: CODE, components: [{ component: "LEC", section: "A00" }] }],
    optionalPool: [],
    pinned: [CODE],
    chosenCourseToRequirement: { [CODE]: "0" },
  }).finish();
  return {
    loadDataset: jest.fn(async () => {}),
    generate: jest.fn(async () => response),
  };
}

function baseInput(overrides: Partial<GenerateScheduleInput> = {}): GenerateScheduleInput {
  return {
    datasetKey: "2261",
    catalogue: buildCatalogue(),
    schedules: buildSchedules(),
    disciplines: DISCIPLINES,
    ratings: null,
    basketCodes: [],
    engine: recordingEngine(),
    variantCount: 1,
    requirements: {
      programUrl: PROGRAM_URL,
      selections: {
        ...DEFAULT_REQUIREMENT_SELECTIONS,
        constrainedPerRequirement: { "req-0": [CODE] },
      },
    },
    ...overrides,
  } as GenerateScheduleInput;
}

describe("generateScheduleVariants advanced requirements", () => {
  it("uses an advanced request when program requirements are available, even with no basket pins", async () => {
    const engine = recordingEngine();
    const { variants } = await generateScheduleVariants(baseInput({ engine }));

    expect(engine.generate).toHaveBeenCalledTimes(1);
    expect(variants).toHaveLength(1);

    const sent = (engine.generate as jest.Mock).mock.calls[0]![0] as Uint8Array;
    const request = GenerationRequest.decode(sent);
    expect(request.basicPinnedCourses).toEqual([]);
    expect(request.remainingRequirements.map((req) => req.requirementId)).toEqual(["req-0"]);
    expect(request.constrainedPerRequirement["req-0"]?.values).toEqual([CODE]);
    expect(request.coursesThisSemester).toBe(5);
  });
});
