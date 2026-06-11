import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PdfPageText } from "./pdfExtraction";
import { detectFrenchImmersionStreamHint, parseTranscriptPdf } from "./transcriptParser";

const { extractTranscriptPdfPagesMock } = vi.hoisted(() => ({
  extractTranscriptPdfPagesMock: vi.fn(),
}));

vi.mock("./pdfExtraction", () => ({
  extractTranscriptPdfPages: extractTranscriptPdfPagesMock,
}));

function textPage(pageText: string): PdfPageText {
  return { pageText, itemsWithPosition: [], hasPosition: false };
}

describe("detectFrenchImmersionStreamHint", () => {
  test("detects English and French transcript labels leniently", () => {
    expect(detectFrenchImmersionStreamHint("Program: French Immersion Stream")).toBe(true);
    expect(detectFrenchImmersionStreamHint("Régime d'immersion française")).toBe(true);
    expect(detectFrenchImmersionStreamHint("Immersion stream requirements satisfied")).toBe(true);
    expect(detectFrenchImmersionStreamHint("Regular English-language program")).toBe(false);
  });
});

describe("parseTranscriptPdf", () => {
  beforeEach(() => {
    extractTranscriptPdfPagesMock.mockReset();
  });

  test("builds transcript data from extracted pages without running pdf.js in the test environment", async () => {
    const pages = [
      textPage(
        "Start of Transcript 2025 Winter\nProgram: French Immersion Stream\nCourse CSI 2101",
      ),
      textPage("Second page has MAT1341 and repeated csi 2101 plus ITD 1100"),
    ];
    extractTranscriptPdfPagesMock.mockResolvedValue(pages);

    const result = await parseTranscriptPdf(new ArrayBuffer(8));

    expect(extractTranscriptPdfPagesMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      courses: ["CSI 2101", "MAT 1341"],
      fullText: pages.map((page) => page.pageText).join("\n"),
      startingYear: 2024,
      frenchImmersionStreamHint: true,
    });
  });

  test("uses the fall transcript year directly and leaves missing stream hints unset", async () => {
    extractTranscriptPdfPagesMock.mockResolvedValue([
      textPage("Start of Transcript 2022 Fall\nCourse ADM 1300"),
    ]);

    await expect(parseTranscriptPdf(new ArrayBuffer(4))).resolves.toMatchObject({
      courses: ["ADM 1300"],
      startingYear: 2022,
      frenchImmersionStreamHint: false,
    });
  });

  test("returns null starting year when no start-of-transcript line is present", async () => {
    extractTranscriptPdfPagesMock.mockResolvedValue([
      textPage("Unofficial transcript\nCourse PSY 1101\nProgramme immersion française"),
    ]);

    await expect(parseTranscriptPdf(new ArrayBuffer(4))).resolves.toMatchObject({
      courses: ["PSY 1101"],
      startingYear: null,
      frenchImmersionStreamHint: true,
    });
  });
});
