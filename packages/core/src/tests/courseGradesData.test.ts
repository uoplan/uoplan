import { describe, expect, it } from "vitest";
import { DataProto, fromProtoCourseGradesData } from "../index";

describe("fromProtoCourseGradesData", () => {
  it("round-trips encoded grades payload", () => {
    // GRADE_KEYS order: A+ A A- B+ B C+ C D+ D E F DR EIN NS NC ABS P S
    const distribution = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const message = {
      professorNames: ["Test Prof"],
      courses: [
        {
          code: "CSI 2110",
          nameRefs: [0],
          termIds: [2251],
          professorRefs: [0],
          legacyIds: [123],
          sections: ["A00"],
          distributions: distribution,
        },
      ],
    };

    const bytes = DataProto.GradesData.encode(message).finish();
    const decoded = DataProto.GradesData.decode(bytes);
    const domain = fromProtoCourseGradesData(decoded);

    expect(domain.courses).toHaveLength(1);
    expect(domain.courses[0].code).toBe("CSI 2110");
    expect(domain.courses[0].professors[0]).toMatchObject({
      name: "Test Prof",
      legacyId: 123,
      termId: 2251,
      section: "A00",
      distribution: expect.objectContaining({ "A+": 1 }),
    });
  });
});
