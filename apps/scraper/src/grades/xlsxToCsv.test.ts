import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emptyDistribution } from "./distribution.ts";
import { listXlsxFiles, readXlsxRows } from "./xlsx.ts";
import { groupByTerm, parseSheetRows, recordsToCsv } from "./xlsxToCsv.ts";
import type { GradeRecord } from "./xlsxToCsv.ts";

function dist(partial: Record<string, number>) {
  return { ...emptyDistribution(), ...partial };
}

describe("parseSheetRows", () => {
  it("parses the A2023-53 layout (header on row 3, TERM col, EIN before F, no DR)", () => {
    // Mirrors `2026-122 001 A2023-53 001.xlsx`: header is the 4th row and the
    // grade columns are ordered with EIN before F. The leading CAREER / FACULTY
    // columns and the trailing Grand Total must be ignored.
    const grid = [
      ["Registrar export"],
      [""],
      ["Generated 2026-01-01"],
      [
        "COURSE_CAREER",
        "TERM",
        "FACULTY",
        "COURSE",
        "CLASS_SECTION",
        "A+",
        "A",
        "A-",
        "B+",
        "B",
        "C+",
        "C",
        "D+",
        "D",
        "E",
        "EIN",
        "F",
        "NC",
        "NS",
        "ABS",
        "P",
        "S",
        "Grand Total",
      ],
      [
        "UGRD",
        "2189",
        "ENG",
        "ADM1100",
        "A00",
        "3",
        "2",
        "1",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "4",
        "0",
        "0",
        "0",
        "0",
        "0",
        "10",
      ],
    ];
    const records = parseSheetRows(grid, "A2023-53");
    expect(records).toHaveLength(1);
    const rec = records[0];
    expect(rec.termId).toBe("2189");
    expect(rec.code).toBe("ADM 1100"); // normalized
    expect(rec.section).toBe("A00");
    expect(rec.distribution["A+"]).toBe(3);
    expect(rec.distribution["F"]).toBe(4);
    expect(rec.distribution["DR"]).toBe(0); // column absent -> 0
  });

  it("parses the CRSES layout (header on row 0, STRM, DR present) and uses COURSE not FACULTY_COURSE", () => {
    // Mirrors `2026-122 009 2026-032 001 CRSES_EDU.xlsx`: both FACULTY_COURSE and
    // COURSE exist. The course code must come from the exact `COURSE` column, not
    // the substring-containing FACULTY_COURSE. DR sits mid-row.
    const grid = [
      [
        "CAREER",
        "FACULTY_COURSE",
        "STRM",
        "COURSE",
        "CLASS_SECTION",
        "DESCR",
        "A+",
        "A",
        "A-",
        "B+",
        "B",
        "C+",
        "C",
        "D+",
        "D",
        "DR",
        "EIN",
        "F",
        "ABS",
        "S",
        "Grand Total",
      ],
      [
        "EDU",
        "WRONG 0000",
        "2255",
        "EDU2500",
        "C00",
        "Intro",
        "5",
        "4",
        "3",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "2",
        "0",
        "1",
        "0",
        "0",
        "15",
      ],
    ];
    const records = parseSheetRows(grid, "CRSES_EDU");
    expect(records).toHaveLength(1);
    const rec = records[0];
    expect(rec.code).toBe("EDU 2500"); // from COURSE, not "WRONG 0000"
    expect(rec.termId).toBe("2255");
    expect(rec.distribution["DR"]).toBe(2);
    expect(rec.distribution["F"]).toBe(1);
  });

  it("matches a lowercase `course` header (MED layout)", () => {
    const grid = [
      [
        "CAREER",
        "FACULTY",
        "STRM",
        "course",
        "DESCR",
        "CLASS_SECTION",
        "A+",
        "A",
        "A-",
        "B+",
        "B",
        "C+",
        "P",
        "S",
        "Grand Total",
      ],
      [
        "MED",
        "MED",
        "2251",
        "MED7100",
        "Clerkship",
        "A00",
        "1",
        "1",
        "0",
        "0",
        "0",
        "0",
        "2",
        "0",
        "4",
      ],
    ];
    const records = parseSheetRows(grid, "MED");
    expect(records[0].code).toBe("MED 7100");
    expect(records[0].distribution["P"]).toBe(2);
  });

  it("skips rows with a blank section or a non-numeric term", () => {
    const grid = [
      ["STRM", "COURSE", "CLASS_SECTION", "A+"],
      ["2259", "BIO 1530", "", "5"], // blank section -> skipped
      ["TOTAL", "BIO 1530", "B00", "5"], // non-numeric term -> skipped
      ["2259", "BIO 1530", "C00", "5"], // kept
    ];
    const records = parseSheetRows(grid, "skip");
    expect(records).toHaveLength(1);
    expect(records[0].section).toBe("C00");
  });

  it("throws when no CLASS_SECTION header is found within the scan limit", () => {
    const grid = Array.from({ length: 12 }, () => ["STRM", "COURSE", "A+"]);
    expect(() => parseSheetRows(grid, "headerless")).toThrow(/CLASS_SECTION/);
  });
});

describe("groupByTerm", () => {
  it("sums duplicate (code, section) within a term and separates terms", () => {
    // A single term can span multiple per-career export files, so the same
    // (code, section) may appear twice and must be summed.
    const records: GradeRecord[] = [
      { termId: "2255", code: "ADM 1100", section: "A00", distribution: dist({ "A+": 1 }) },
      { termId: "2255", code: "ADM 1100", section: "A00", distribution: dist({ "A+": 2, DR: 1 }) },
      { termId: "2255", code: "ADM 1100", section: "B00", distribution: dist({ A: 4 }) },
      { termId: "2259", code: "ADM 1100", section: "A00", distribution: dist({ "A+": 9 }) },
    ];
    const byTerm = groupByTerm(records);
    expect([...byTerm.keys()].sort()).toEqual(["2255", "2259"]);

    const t2255 = byTerm.get("2255")!;
    expect(t2255).toHaveLength(2); // A00 (merged) + B00
    const a00 = t2255.find((r) => r.section === "A00")!;
    expect(a00.distribution["A+"]).toBe(3);
    expect(a00.distribution["DR"]).toBe(1);

    expect(byTerm.get("2259")![0].distribution["A+"]).toBe(9);
  });

  it("does not mutate the input distributions when merging", () => {
    const first = { termId: "2255", code: "X 1000", section: "A", distribution: dist({ "A+": 1 }) };
    const records: GradeRecord[] = [
      first,
      { termId: "2255", code: "X 1000", section: "A", distribution: dist({ "A+": 5 }) },
    ];
    groupByTerm(records);
    expect(first.distribution["A+"]).toBe(1); // original untouched
  });
});

describe("recordsToCsv", () => {
  it("emits the per-term CSV header with DR after F and values in GRADE_KEYS order", () => {
    const records: GradeRecord[] = [
      {
        termId: "2259",
        code: "ADM 1100",
        section: "A00",
        distribution: dist({ "A+": 3, F: 1, DR: 2 }),
      },
    ];
    const csv = recordsToCsv(records);
    const [header, row] = csv.trimEnd().split("\n");
    expect(header).toBe("term,course,section,A+,A,A-,B+,B,C+,C,D+,D,E,F,DR,EIN,NS,NC,ABS,P,S");
    expect(row).toBe("2259,ADM 1100,A00,3,0,0,0,0,0,0,0,0,0,1,2,0,0,0,0,0,0");
    expect(csv.endsWith("\n")).toBe(true);
  });
});

describe("listXlsxFiles", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "xlsx-list-"));
    await Promise.all(
      ["001.xlsx", "~$001.xlsx", "002.XLSX", "notes.txt"].map((f) =>
        fs.writeFile(path.join(dir, f), "x", "utf-8"),
      ),
    );
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns real .xlsx files (any case) and skips ~$ lock files and non-xlsx", async () => {
    expect(await listXlsxFiles(dir)).toEqual(["001.xlsx", "002.XLSX"]);
  });

  it("throws a helpful error when the directory does not exist", async () => {
    await expect(listXlsxFiles(path.join(dir, "missing"))).rejects.toThrow(/not found/);
  });
});

describe("readXlsxRows", () => {
  it("reads the first worksheet into a dense string grid (numbers stringified)", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["STRM", "COURSE", "CLASS_SECTION", "A+"]);
    ws.addRow(["2259", "ADM 1100", "A00", 7]);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "xlsx-read-"));
    const file = path.join(dir, "t.xlsx");
    await wb.xlsx.writeFile(file);

    const rows = await readXlsxRows(file);
    expect(rows[0]).toEqual(["STRM", "COURSE", "CLASS_SECTION", "A+"]);
    expect(rows[1]).toEqual(["2259", "ADM 1100", "A00", "7"]); // number -> "7"

    await fs.rm(dir, { recursive: true, force: true });
  });
});
