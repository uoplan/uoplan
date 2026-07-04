import { describe, expect, test } from "vitest";
import { collectTranscriptTerms } from "./termGrouping";
import type { PdfPageText, TextItemWithPosition } from "./types";

/**
 * Build a positioned page from a visual layout: each entry is a row of cells at
 * a descending y (top→bottom). Cells are spaced along x so the grouping/sorting
 * logic sees a realistic transcript table.
 */
function positionedPage(rows: string[][]): PdfPageText {
  const items: TextItemWithPosition[] = [];
  let y = 800;
  for (const cells of rows) {
    let x = 40;
    for (const cell of cells) {
      items.push({ str: cell, x, y });
      x += 80;
    }
    y -= 16;
  }
  return {
    pageText: rows.map((r) => r.join(" ")).join("\n"),
    itemsWithPosition: items,
    hasPosition: true,
  };
}

describe("collectTranscriptTerms", () => {
  test("groups courses under their term headers across pages, chronologically", () => {
    const page1 = positionedPage([
      ["Start of Transcript"],
      ["2022 Fall Term"],
      ["Honours Bachelor of Science"],
      ["Course", "Description", "Grade", "Earned", "Average", "Size"],
      ["ADM", "1100", "Introduction to Business", "B+", "3.00"],
      ["ITD", "1100", "UO-Academic Integrity", "S", "CR"],
      ["ITI", "1120", "Introduction to Computing I", "A+", "3.00"],
      ["TGPA", "9.40", "Total", "15.00"],
      ["2023 Winter Term"],
      ["Course", "Description", "Grade", "Earned", "Average", "Size"],
      ["ITI", "1100", "Digital Systems I", "A", "3.00"],
      ["MAT", "1322", "Calculus II", "A+", "3.00"],
      ["CGPA", "9.20", "Total", "30.00"],
    ]);
    const page2 = positionedPage([
      ["2024 Spring/Summer Term"],
      ["Course", "Description", "Grade", "Earned", "Average", "Size"],
      ["CGI", "2901", "Co-op Work Term", "P", "3.00"],
    ]);

    const terms = collectTranscriptTerms([page1, page2]);

    expect(terms).toEqual([
      {
        label: "Fall 2022",
        year: 2022,
        season: "Fall",
        // ITD 1100 is a non-degree course and is filtered out (matches the flat list).
        courses: ["ADM 1100", "ITI 1120"],
      },
      {
        label: "Winter 2023",
        year: 2023,
        season: "Winter",
        courses: ["ITI 1100", "MAT 1322"],
      },
      {
        label: "Summer 2024",
        year: 2024,
        season: "Summer",
        courses: ["CGI 2901"],
      },
    ]);
  });

  test("orders terms chronologically even when pages arrive out of order", () => {
    const winter = positionedPage([
      ["2024 Winter Term"],
      ["CSI", "2101", "Discrete Structures", "A+", "3.00"],
    ]);
    const fall = positionedPage([
      ["2023 Fall Term"],
      ["CEG", "2136", "Computer Architecture I", "A", "3.00"],
    ]);

    const terms = collectTranscriptTerms([winter, fall]);
    expect(terms.map((t) => t.label)).toEqual(["Fall 2023", "Winter 2024"]);
  });

  test("parses a French term header (season before year)", () => {
    const page = positionedPage([
      ["Automne 2022"],
      ["ADM", "1100", "Introduction aux affaires", "B+", "3.00"],
    ]);
    const terms = collectTranscriptTerms([page]);
    expect(terms).toEqual([
      { label: "Fall 2022", year: 2022, season: "Fall", courses: ["ADM 1100"] },
    ]);
  });

  test("returns no terms for position-less pages (caller falls back)", () => {
    expect(
      collectTranscriptTerms([
        { pageText: "2022 Fall Term ADM 1100", itemsWithPosition: [], hasPosition: false },
      ]),
    ).toEqual([]);
  });

  test("ignores course rows before any term header", () => {
    const page = positionedPage([
      ["CSI", "2110", "Data Structures", "A+", "3.00"],
      ["2023 Fall Term"],
      ["SEG", "2105", "Software Engineering", "A+", "3.00"],
    ]);
    const terms = collectTranscriptTerms([page]);
    expect(terms).toEqual([
      { label: "Fall 2023", year: 2023, season: "Fall", courses: ["SEG 2105"] },
    ]);
  });
});
