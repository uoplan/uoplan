import { describe, expect, test } from "vitest";
import {
  detectFrenchImmersionStreamHint,
  parseStartingYear,
  processExtractedPages,
} from "./parseHelpers";
import type { PdfPageText } from "./types";

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

describe("parseStartingYear", () => {
  test("shifts non-fall start terms back a year and uses fall years directly", () => {
    expect(parseStartingYear("Start of Transcript 2025 Winter")).toBe(2024);
    expect(parseStartingYear("Start of Transcript 2022 Fall")).toBe(2022);
    expect(parseStartingYear("Start of Transcript 2023 Spring")).toBe(2022);
  });

  test("returns null when no start-of-transcript line is present", () => {
    expect(parseStartingYear("Unofficial transcript\nCourse PSY 1101")).toBeNull();
  });
});

describe("processExtractedPages", () => {
  test("derives courses, full text, starting year, and stream hint from extracted pages", () => {
    const pages = [
      textPage("Start of Transcript 2025 Winter\nProgram: French Immersion Stream\nCourse CSI 2101"),
      textPage("Second page has MAT1341 and repeated csi 2101 plus ITD 1100"),
    ];

    expect(processExtractedPages(pages)).toEqual({
      courses: ["CSI 2101", "MAT 1341"],
      fullText: pages.map((page) => page.pageText).join("\n"),
      startingYear: 2024,
      frenchImmersionStreamHint: true,
    });
  });

  test("uses the fall transcript year directly and leaves missing stream hints unset", () => {
    expect(processExtractedPages([textPage("Start of Transcript 2022 Fall\nCourse ADM 1300")])).toEqual(
      {
        courses: ["ADM 1300"],
        fullText: "Start of Transcript 2022 Fall\nCourse ADM 1300",
        startingYear: 2022,
        frenchImmersionStreamHint: false,
      },
    );
  });

  test("returns null starting year when no start-of-transcript line is present", () => {
    expect(
      processExtractedPages([
        textPage("Unofficial transcript\nCourse PSY 1101\nProgramme immersion française"),
      ]),
    ).toEqual({
      courses: ["PSY 1101"],
      fullText: "Unofficial transcript\nCourse PSY 1101\nProgramme immersion française",
      startingYear: null,
      frenchImmersionStreamHint: true,
    });
  });
});
