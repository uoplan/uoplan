import { describe, expect, it } from "vitest";

import type { CatalogueLike } from "../stateEncode";
import { decodeStateFromBase64 } from "../stateEncode";
import type { Indices, Program } from "../dataTypes";

/**
 * Golden wire-format test.
 *
 * `GOLDEN` was produced by the encoder at the current `ShareableState` proto
 * version. It pins the on-the-wire byte format of shared URLs / persisted
 * state. If a proto change (e.g. renumbering the `DayOfWeek` enum, reusing a
 * field number) breaks backwards compatibility, decoding this string will no
 * longer reproduce the expected values and this test will fail — catching the
 * regression before it ships and silently corrupts existing user URLs.
 *
 * Do NOT regenerate this string to make the test pass. A change here means a
 * wire-incompatible change that needs a migration path.
 *
 * (Regenerated for the STATE_MAGIC bump to 0x554f504e — the deliberate clean
 * break that removed the hard `generation_min_professor_rating` field in favour
 * of the soft `generation_prefer_higher_professor_rating` preference. The
 * earlier 0x554f504d bump moved `completed_courses` to plain packed indices.)
 */
const GOLDEN = "42AUYlBi0Ohdx2PB4MUQxMgYxZDEkMVQwLqIkWEFI+MOxjksBxh3cJxiZHjBeG7B3lWsm5gYAA==";

const programA: Program = {
  title: "BSc Computer Science",
  url: "https://catalogue.uottawa.ca/en/undergrad/bsc-computer-science/",
  slug: "undergrad/bsc-computer-science",
  requirements: [],
};

const catalogue: CatalogueLike = {
  courses: [{ code: "CSI 2110" }, { code: "MAT 1320" }, { code: "PHY 1122" }],
  programs: [programA],
};

const indices: Indices = {
  courses: ["CSI 2110", "MAT 1320", "PHY 1122"],
  programs: ["undergrad/bsc-computer-science"],
  disciplines: ["CSI", "MAT", "PHY"],
};

describe("ShareableState golden wire format", () => {
  it("decodes the pinned golden payload to the expected values", () => {
    const decoded = decodeStateFromBase64(GOLDEN, catalogue, indices);
    expect("error" in decoded).toBe(false);
    if ("error" in decoded) return;

    expect(decoded.selectedTermId).toBe("202509");
    expect(decoded.program?.title).toBe("BSc Computer Science");
    expect(decoded.completedCourseCodes).toEqual(["MAT 1320"]);
    expect(decoded.coursesThisSemester).toBe(5);
    expect(decoded.generationMinStartMinutes).toBe(540);
    expect(decoded.generationMaxEndMinutes).toBe(1080);
  });
});
