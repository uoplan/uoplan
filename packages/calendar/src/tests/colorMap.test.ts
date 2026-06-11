import { describe, expect, it } from "vitest";
import { buildColorMap } from "../colorMap";
import { makeSchedule } from "./fixtures";

describe("buildColorMap re-export", () => {
  it("assigns stable colour indices by sorted unique course code", () => {
    const schedule = makeSchedule([
      { courseCode: "CSI 2101", sections: [] },
      { courseCode: "ADM 1100", sections: [] },
      { courseCode: "CSI 2101", sections: [] },
      { courseCode: "BIO 1130", sections: [] },
    ]);

    expect(buildColorMap(schedule)).toEqual({
      "ADM 1100": 0,
      "BIO 1130": 1,
      "CSI 2101": 2,
    });
  });
});
