import { describe, expect, it } from "vitest";

import { Catalogue as ProtoCatalogue } from "@uoplan/proto/data";

import type { Catalogue } from "../dataTypes";
import { fromProtoCatalogue, toProtoCatalogue } from "../dataTypes";

/**
 * The additive `levels` field on a discipline-less elective ProgramRequirement
 * is part of the committed `.pb` wire format. Verify a full object -> proto ->
 * binary -> proto -> object round-trip preserves it, and that absent/empty
 * levels stay omitted.
 */
describe("program-requirement levels wire contract", () => {
  function roundTrip(catalogue: Catalogue): Catalogue {
    const wire = ProtoCatalogue.encode(toProtoCatalogue(catalogue)).finish();
    return fromProtoCatalogue(ProtoCatalogue.decode(wire));
  }

  it("round-trips levels on an elective requirement", () => {
    const catalogue: Catalogue = {
      courses: [],
      programs: [
        {
          title: "Test Program",
          url: "https://example.com/p1",
          requirements: [
            { type: "elective", title: "9 units at 3000/4000", credits: 9, levels: [3000, 4000] },
          ],
        },
      ],
    };

    const decoded = roundTrip(catalogue);
    expect(decoded.programs[0].requirements[0].levels).toEqual([3000, 4000]);
  });

  it("omits levels when not present", () => {
    const catalogue: Catalogue = {
      courses: [],
      programs: [
        {
          title: "No Levels",
          url: "https://example.com/p2",
          requirements: [{ type: "elective", title: "9 units", credits: 9 }],
        },
      ],
    };

    const decoded = roundTrip(catalogue);
    expect(decoded.programs[0].requirements[0].levels).toBeUndefined();
  });
});
