import { describe, expect, it } from "vitest";
import { mapGradesJson } from "./grades.ts";

describe("mapGradesJson", () => {
  it("keeps nameless grade sections as sections without professor identity", () => {
    const mapped = mapGradesJson([
      {
        code: "CSI 2110",
        sections: [
          {
            termId: 2251,
            section: "A00",
            distribution: { "A+": 4 },
          },
        ],
      },
    ]);

    expect(mapped.courses).toHaveLength(1);
    expect(mapped.courses[0]).toMatchObject({
      code: "CSI 2110",
      nameRefs: [0],
      termIds: [2251],
      professorRefs: [0],
      legacyIds: [0],
      sections: ["A00"],
    });
    expect(mapped.sectionNames).toEqual([""]);
  });
});
