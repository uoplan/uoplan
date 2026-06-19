import { describe, expect, it } from "vitest";

import { extractPreviouslyAliases } from "./aliases.ts";

describe("extractPreviouslyAliases", () => {
  it("captures a single previous code", () => {
    expect(extractPreviouslyAliases("Previously ART 3016.", "ART 3916")).toEqual(["ART 3016"]);
  });

  it("captures multiple previous codes joined by a conjunction", () => {
    expect(
      extractPreviouslyAliases(
        "Previously CHM 4006 and CHM 4910. Permission required.",
        "CHM 40102",
      ),
    ).toEqual(["CHM 4006", "CHM 4910"]);
  });

  it("does not absorb prerequisite codes from a following bilingual sentence", () => {
    // Regression: the bilingual "X. / Prerequisites: …" form previously caused the
    // sentence-boundary heuristic to sweep prerequisite codes into the alias list,
    // wrongly linking a 1st-year course (ART 1331) to ART 3916 via transitive aliases.
    const component =
      "Préalables : ART 1711, 6 crédits de cours parmi (ART 1721, ART 1731, ART 1741). " +
      "Réservé aux étudiantes et étudiants. Antérieurement ART 3016. / " +
      "Prerequisites: ART 1311, 6 course units from (ART 1321, ART 1331, ART 1341). " +
      "Reserved for students. Previously ART 3016.";
    expect(extractPreviouslyAliases(component, "ART 3916")).toEqual(["ART 3016"]);
  });

  it("does not absorb equivalence codes from a following sentence", () => {
    const component =
      "Antérieurement MUS 2990. Ce cours est équivalent à MUS 2591, MUS 2592 et MUS 2594.";
    expect(extractPreviouslyAliases(component, "MUS 2593")).toEqual(["MUS 2990"]);
  });

  it("excludes the course's own code", () => {
    expect(extractPreviouslyAliases("Previously ART 3916 and ART 3016.", "ART 3916")).toEqual([
      "ART 3016",
    ]);
  });

  it("returns an empty list when there is no previous-code clause", () => {
    expect(extractPreviouslyAliases("Prerequisites: ART 1311.", "ART 3916")).toEqual([]);
  });
});
