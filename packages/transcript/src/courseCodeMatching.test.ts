import { describe, expect, test } from "vitest";
import { collectTranscriptCourseCodes } from "./courseCodeMatching";
import type { PdfPageText } from "./pdfExtraction";

function textPage(pageText: string): PdfPageText {
  return { pageText, itemsWithPosition: [], hasPosition: false };
}

describe("collectTranscriptCourseCodes", () => {
  test("normalizes transcript course codes, deduplicates repeated mentions, and excludes non-degree courses", () => {
    const courses = collectTranscriptCourseCodes([
      textPage("Course Description Grade Units csi2101 Discrete Structures MAT 1341 ITD 1100"),
      textPage("Repeated on summary page: CSI 2101, mat1341, SEG 2105A and ITD 1500"),
    ]);

    expect(courses).toEqual(["CSI 2101", "MAT 1341", "SEG 2105A"]);
  });

  test("reconstructs positioned table rows and assigns stable OPT placeholders by level", () => {
    const courses = collectTranscriptCourseCodes([
      {
        pageText: "Course Credits Grade",
        hasPosition: true,
        itemsWithPosition: [
          { str: "2101", x: 120, y: 700 },
          { str: "CSI", x: 40, y: 702 },
          { str: "1XXX", x: 120, y: 680 },
          { str: "OPT", x: 40, y: 681 },
          { str: "2XXX", x: 120, y: 660 },
          { str: "OPT", x: 40, y: 660 },
          { str: "1XXX", x: 120, y: 640 },
          { str: "OPT", x: 40, y: 640 },
          { str: "1100", x: 120, y: 620 },
          { str: "ITD", x: 40, y: 620 },
        ],
      },
    ]);

    expect(courses).toEqual(["CSI 2101", "OPT 1000", "OPT 2000", "OPT 1001"]);
  });

  test("extracts OPT placeholders from unpositioned text without colliding across pages", () => {
    const courses = collectTranscriptCourseCodes([
      textPage("Transfer Credit OPT 1XXX Introductory elective"),
      textPage("Transfer Credit OPT 1XXX Additional elective OPT 3XXX"),
    ]);

    expect(courses).toEqual(["OPT 1000", "OPT 1001", "OPT 3000"]);
  });
});
