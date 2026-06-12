import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assembleGrades } from "./build.ts";
import { readGradeRows } from "./csv.ts";
import type { GradeRow } from "./csv.ts";
import { emptyDistribution, normalizeCode } from "./distribution.ts";
import { feedbackKey } from "./feedbackProfs.ts";
import { createProfessorResolver, normalizeName } from "./rmp.ts";
import type { ProfessorResolver } from "./rmp.ts";

describe("normalizeCode", () => {
  it("inserts the canonical space and uppercases", () => {
    expect(normalizeCode("adm1100")).toBe("ADM 1100");
    expect(normalizeCode("  ADM 1100 ")).toBe("ADM 1100");
    expect(normalizeCode("csi 3540")).toBe("CSI 3540");
  });
});

function dist(partial: Record<string, number>) {
  return { ...emptyDistribution(), ...partial };
}

describe("readGradeRows", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "grades-csv-"));
    // Mixed header case/order, a missing grade column (NC), and duplicate
    // (term, course, section) rows that must be summed.
    await fs.writeFile(
      path.join(dir, "a.csv"),
      [
        "Term,Course,Section,A+,A,F,DR,EIN,NS,ABS,P,S,A-,B+,B,C+,C,D+,D,E",
        "2259,ADM1100,A00,3,2,1,5,0,0,0,0,0,0,0,0,0,0,0,0,0",
        "2259,ADM 1100,A00,1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0",
      ].join("\n"),
      "utf-8",
    );
    await fs.writeFile(
      path.join(dir, "b.csv"),
      ["term,course,section,A+,A", "2261,BIO 1530,B00,5,4"].join("\n"),
      "utf-8",
    );
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("aggregates duplicate rows and parses termId as the raw STRM", async () => {
    const rows = await readGradeRows(dir);
    const adm = rows.find((r) => r.code === "ADM 1100");
    expect(adm).toBeDefined();
    expect(adm?.termId).toBe(2259);
    expect(adm?.distribution["A+"]).toBe(4);
    expect(adm?.distribution["A"]).toBe(2);
    expect(adm?.distribution["F"]).toBe(1);
    expect(adm?.distribution["DR"]).toBe(7); // withdrawals summed across rows
    expect(adm?.distribution["NC"]).toBe(0); // missing column defaults to 0

    const bio = rows.find((r) => r.code === "BIO 1530");
    expect(bio?.termId).toBe(2261);
    expect(bio?.distribution["A+"]).toBe(5);
  });
});

describe("assembleGrades", () => {
  const rows: GradeRow[] = [
    { termId: 2259, code: "ADM 1100", section: "A00", distribution: dist({ "A+": 3 }) },
    { termId: 2259, code: "ADM 1100", section: "B00", distribution: dist({ A: 2 }) },
    { termId: 2259, code: "BIO 1530", section: "C00", distribution: dist({ F: 1 }) },
  ];
  const feedback = new Map<string, string[]>([
    [feedbackKey(2259, "ADM 1100", "A00"), ["Jane Doe"]],
    [feedbackKey(2259, "ADM 1100", "B00"), ["John Roe"]],
    // BIO 1530 C00 has no feedback professor.
  ]);
  const resolve: ProfessorResolver = (name) =>
    name === "Jane Doe" ? { name: "Jane Doe", legacyId: 12345 } : { name };
  const catalogue = ["ADM 1100", "BIO 1530", "CSI 2110"]; // CSI has no grade data

  it("attaches professors, omits legacyId when unmatched, and covers all catalogue codes", () => {
    const { output, stats } = assembleGrades(rows, feedback, resolve, catalogue);

    const codes = output.map((c) => c.code);
    expect(codes).toEqual(["ADM 1100", "BIO 1530", "CSI 2110"]); // sorted

    const adm = output.find((c) => c.code === "ADM 1100")!;
    expect(adm.professors.map((p) => p.name)).toEqual(["Jane Doe", "John Roe"]);
    expect(adm.professors[0].legacyId).toBe(12345);
    expect("legacyId" in adm.professors[1]).toBe(false); // John Roe not in RMP

    // BIO 1530 C00 had no feedback match -> dropped (empty professors).
    expect(output.find((c) => c.code === "BIO 1530")!.professors).toEqual([]);
    // CSI 2110 is a catalogue code with no grade data.
    expect(output.find((c) => c.code === "CSI 2110")!.professors).toEqual([]);

    expect(stats.codes).toBe(3);
    expect(stats.codesWithProfessors).toBe(1);
    expect(stats.professorEntries).toBe(2);
    expect(stats.rowsWithoutFeedbackMatch).toBe(1);
    expect(stats.professorsWithoutLegacyId).toBe(1);
  });

  it("preserves canonical distribution key order", () => {
    const { output } = assembleGrades(rows, feedback, resolve, catalogue);
    const keys = Object.keys(output.find((c) => c.code === "ADM 1100")!.professors[0].distribution);
    expect(keys.slice(0, 4)).toEqual(["A+", "A", "A-", "B+"]);
  });

  it("emits one professor entry per professor for team-taught sections", () => {
    const teamRows: GradeRow[] = [
      { termId: 2259, code: "PHY 1100", section: "A00", distribution: dist({ "A+": 4 }) },
    ];
    const teamFeedback = new Map<string, string[]>([
      [feedbackKey(2259, "PHY 1100", "A00"), ["Jane Doe", "John Roe"]],
    ]);
    const { output, stats } = assembleGrades(teamRows, teamFeedback, resolve, ["PHY 1100"]);
    const phy = output.find((c) => c.code === "PHY 1100")!;

    expect(phy.professors.map((p) => p.name)).toEqual(["Jane Doe", "John Roe"]);
    // Both professors carry the section's (single) distribution.
    expect(phy.professors[0].distribution["A+"]).toBe(4);
    expect(phy.professors[1].distribution["A+"]).toBe(4);
    expect(phy.professors[0].legacyId).toBe(12345);
    expect("legacyId" in phy.professors[1]).toBe(false);
    expect(stats.professorEntries).toBe(2);
    expect(stats.rowsWithoutFeedbackMatch).toBe(0);
  });

  it("dedupes when distinct feedback names resolve to the same professor", () => {
    // Both feedback names resolve to the canonical RMP name "Jane Doe".
    const remap: ProfessorResolver = () => ({ name: "Jane Doe", legacyId: 12345 });
    const dupRows: GradeRow[] = [
      { termId: 2259, code: "PHY 1100", section: "A00", distribution: dist({ "A+": 4 }) },
    ];
    const dupFeedback = new Map<string, string[]>([
      [feedbackKey(2259, "PHY 1100", "A00"), ["Jane J. Doe", "Jane Doe"]],
    ]);
    const { output, stats } = assembleGrades(dupRows, dupFeedback, remap, ["PHY 1100"]);
    const phy = output.find((c) => c.code === "PHY 1100")!;
    expect(phy.professors.map((p) => p.name)).toEqual(["Jane Doe"]); // deduped
    expect(stats.professorEntries).toBe(1);
  });
});

describe("createProfessorResolver", () => {
  const resolver = createProfessorResolver([
    { name: "Andrew Forward", legacyId: 111 },
    { name: "Emmanuelle Fréchette", legacyId: 222 },
    // Ambiguous (first, last) = (chris, smith): two distinct people.
    { name: "Chris Smith", legacyId: 333 },
    { name: "Chris A. Smith", legacyId: 444 },
  ]);

  it("matches exactly, ignoring accents and punctuation", () => {
    expect(resolver("Emmanuelle Frechette")).toEqual({
      name: "Emmanuelle Fréchette",
      legacyId: 222,
    });
  });

  it("fuzzy-matches on first+last when middle names differ", () => {
    expect(resolver("Andrew James Henry Forward")).toEqual({
      name: "Andrew Forward",
      legacyId: 111,
    });
  });

  it("does not fuzzy-match an ambiguous first+last pair", () => {
    // (chris, smith) maps to two distinct RMP people, so a middle-name variant
    // must NOT be guessed — the original feedback name is kept.
    expect(resolver("Chris Michael Smith")).toEqual({ name: "Chris Michael Smith" });
  });

  it("returns the original name when there is no match", () => {
    expect(resolver("Nobody Here")).toEqual({ name: "Nobody Here" });
  });
});

describe("normalizeName", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeName("Jean-François O'Brien")).toBe("jean francois o brien");
  });
});
