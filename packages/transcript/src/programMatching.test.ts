import { describe, expect, test } from "vitest";
import { findBestMatchingProgram } from "./programMatching";

interface ProgramFixture {
  title: string;
  url: string;
}

const programs: ProgramFixture[] = [
  { title: "Honours BSc Computer Science", url: "/programs/computer-science" },
  { title: "Honours BSc Mathematics", url: "/programs/mathematics" },
  { title: "Honours BA Psychology", url: "/programs/psychology" },
];

const minors: ProgramFixture[] = [
  { title: "Minor in Mathematics", url: "/minors/mathematics" },
  { title: "Minor in Psychology", url: "/minors/psychology" },
];

describe("findBestMatchingProgram", () => {
  test("matches the latest semester program and its minor from the transcript header", () => {
    const result = findBestMatchingProgram(
      [
        "2023 Fall Term Honours Bachelor of Science in Mathematics Course Description Grade",
        "MAT 1320 Calculus I A",
        "2024 Winter Term Honours Bachelor of Science in Computer Science with Minor in Mathematics Course Description Grade",
        "CSI 2101 Discrete Structures A",
      ].join("\n"),
      programs,
      minors,
    );

    expect(result.program).toEqual(programs[0]);
    expect(result.minor).toEqual(minors[0]);
  });

  test("falls back to nearby multiline text when the term-to-course header is unavailable", () => {
    const result = findBestMatchingProgram(
      [
        "Academic Program",
        "Honours BSc",
        "Computer Science",
        "Academic Plan",
        "Course Description Grade",
      ].join("\n"),
      programs,
      minors,
    );

    expect(result).toEqual({ program: programs[0], minor: null });
  });

  test("does not guess when transcript text has no close program title", () => {
    const result = findBestMatchingProgram(
      "Administrative transcript copy\nNo degree information is present\nCourse Description Grade",
      programs,
      minors,
    );

    expect(result).toEqual({ program: null, minor: null });
  });

  test("returns no match when there are no candidate programs or no transcript text", () => {
    expect(
      findBestMatchingProgram("2025 Fall Term Honours BSc Computer Science Course", []),
    ).toEqual({ program: null, minor: null });
    expect(findBestMatchingProgram("   ", programs)).toEqual({ program: null, minor: null });
  });
});
