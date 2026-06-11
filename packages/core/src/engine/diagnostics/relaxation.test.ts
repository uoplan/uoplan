import { describe, expect, it } from "vitest";
import { buildDataCache } from "../../dataCache";
import type { Catalogue, SchedulesData } from "../../dataTypes";
import type { GenerationConstraints } from "../../generation";
import { makeSchedule, makeSection } from "../../generation/tests/golden/fixtures";
import { diagnoseByRelaxation } from "./relaxation";
import { normalizeCourseCode } from "../../utils/courseUtils";

const NO_CONSTRAINTS: GenerationConstraints = {
  minStartMinutes: 0,
  maxEndMinutes: 24 * 60,
};

function buildCache(): ReturnType<typeof buildDataCache> {
  const catalogue: Catalogue = {
    courses: [
      { code: normalizeCourseCode("AAA 1000"), title: "A", credits: 3, description: "" },
      { code: normalizeCourseCode("BBB 1000"), title: "B", credits: 3, description: "" },
    ],
    programs: [],
  };
  const schedules: SchedulesData = {
    termId: "0",
    schedules: [
      // AAA only meets in the early morning.
      makeSchedule(normalizeCourseCode("AAA 1000"), {
        LEC: [makeSection("LEC", "A", [{ day: "Mo", start: 480, end: 570 }])],
      }),
      // BBB meets later, on a different day — no mutual conflict.
      makeSchedule(normalizeCourseCode("BBB 1000"), {
        LEC: [makeSection("LEC", "A", [{ day: "Tu", start: 600, end: 690 }])],
      }),
    ],
  };
  return buildDataCache(catalogue, schedules);
}

const cache = buildCache();
const base = {
  pinned: [normalizeCourseCode("AAA 1000"), normalizeCourseCode("BBB 1000")] as string[],
  optional: [] as string[],
  targetCount: 2,
  cache,
};

describe("diagnoseByRelaxation", () => {
  it("reports schedulable when no constraint blocks", () => {
    const out = diagnoseByRelaxation({ ...base, constraints: NO_CONSTRAINTS });
    expect(out.kind).toBe("schedulable");
  });

  it("identifies the specific single constraint that blocks (time window)", () => {
    // AAA's only section starts at 08:00; require start >= 09:00 => AAA filtered out.
    const out = diagnoseByRelaxation({
      ...base,
      constraints: { ...NO_CONSTRAINTS, minStartMinutes: 540 },
    });
    expect(out.kind).toBe("single_blockers");
    if (out.kind === "single_blockers") {
      expect(out.blockers.map((b) => b.id)).toEqual(["time-window"]);
    }
  });

  it("reports structural_conflict when the courses themselves clash", () => {
    const catalogue: Catalogue = {
      courses: [
        { code: normalizeCourseCode("AAA 1000"), title: "A", credits: 3, description: "" },
        { code: normalizeCourseCode("BBB 1000"), title: "B", credits: 3, description: "" },
      ],
      programs: [],
    };
    const schedules: SchedulesData = {
      termId: "0",
      schedules: [
        makeSchedule(normalizeCourseCode("AAA 1000"), {
          LEC: [makeSection("LEC", "A", [{ day: "Mo", start: 600, end: 690 }])],
        }),
        makeSchedule(normalizeCourseCode("BBB 1000"), {
          LEC: [makeSection("LEC", "A", [{ day: "Mo", start: 660, end: 750 }])],
        }),
      ],
    };
    const clashCache = buildDataCache(catalogue, schedules);
    const out = diagnoseByRelaxation({
      pinned: [normalizeCourseCode("AAA 1000"), normalizeCourseCode("BBB 1000")],
      optional: [],
      targetCount: 2,
      cache: clashCache,
      constraints: { ...NO_CONSTRAINTS, minStartMinutes: 540 },
    });
    // Even removing the time window leaves an unavoidable Monday overlap.
    expect(out.kind).toBe("structural_conflict");
  });
});
