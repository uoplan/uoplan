import { describe, expect, it } from "vitest";
import { DataProto, fromProtoCourseGradesData } from "../index";

describe("fromProtoCourseGradesData", () => {
  it("round-trips encoded grades payload", () => {
    const message = {
      courses: [
        {
          code: "CSI 2110",
          professors: [
            {
              name: "Test Prof",
              legacyId: 123,
              termId: 2251,
              section: "A00",
              distribution: {
                aPlus: 1,
                a: 0,
                aMinus: 0,
                bPlus: 0,
                b: 0,
                cPlus: 0,
                c: 0,
                dPlus: 0,
                d: 0,
                e: 0,
                f: 0,
                dr: 0,
                ein: 0,
                ns: 0,
                nc: 0,
                abs: 0,
                p: 0,
                s: 0,
              },
            },
          ],
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
