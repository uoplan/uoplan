import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { fromProtoCatalogue, toProtoCatalogue } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";
import type { Catalogue } from "../dataTypes";

function roundTrip(input: Catalogue): Catalogue {
  const bytes = DataProto.Catalogue.encode(toProtoCatalogue(input)).finish();
  return fromProtoCatalogue(DataProto.Catalogue.decode(bytes));
}

describe("catalogue program-requirement code_ref / credits_x4", () => {
  it("resolves in-dictionary refs, extra-code refs, and quarter-credit values", () => {
    const input: Catalogue = {
      courses: [
        {
          code: normalizeCourseCode("CSI 2110"),
          title: "Data Structures",
          credits: 3,
          description: "",
        },
        { code: normalizeCourseCode("MAT 1320"), title: "Calculus I", credits: 3, description: "" },
      ],
      programs: [
        {
          title: "Honours Computer Science",
          url: "",
          slug: "hon-cs",
          requirements: [
            // In-dictionary course reference.
            { type: "course", code: normalizeCourseCode("CSI 2110"), credits: 3 },
            // Cross-year reference not present in course_codes -> extra_codes.
            { type: "course", code: normalizeCourseCode("PHY 9999"), credits: 1.5 },
            // Nested options referencing both kinds, plus a fractional credit.
            {
              type: "options_group",
              credits: 0.25,
              options: [
                { type: "course", code: normalizeCourseCode("MAT 1320"), credits: 3 },
                { type: "course", code: normalizeCourseCode("BIO 8888"), credits: 6 },
              ],
            },
          ],
        },
      ],
    };

    const proto = toProtoCatalogue(input);
    // The extra-codes list holds exactly the two cross-year references.
    expect(proto.extraCodes).toEqual(["PHY 9999", "BIO 8888"]);

    const result = roundTrip(input);
    const reqs = result.programs[0].requirements;
    expect(reqs[0].code).toBe(normalizeCourseCode("CSI 2110"));
    expect(reqs[0].credits).toBe(3);
    expect(reqs[1].code).toBe(normalizeCourseCode("PHY 9999"));
    expect(reqs[1].credits).toBe(1.5);
    expect(reqs[2].credits).toBe(0.25);
    expect(reqs[2].options?.[0].code).toBe(normalizeCourseCode("MAT 1320"));
    expect(reqs[2].options?.[1].code).toBe(normalizeCourseCode("BIO 8888"));
    expect(reqs[2].options?.[1].credits).toBe(6);
  });

  it("omits code/credits when the requirement has neither", () => {
    const input: Catalogue = {
      courses: [
        { code: normalizeCourseCode("CSI 2110"), title: "DS", credits: 3, description: "" },
      ],
      programs: [
        {
          title: "P",
          url: "",
          slug: "p",
          requirements: [{ type: "elective", title: "3 units elective" }],
        },
      ],
    };
    const req = roundTrip(input).programs[0].requirements[0];
    expect(req.code).toBeUndefined();
    expect(req.credits).toBeUndefined();
    expect(req.title).toBe("3 units elective");
  });
});
