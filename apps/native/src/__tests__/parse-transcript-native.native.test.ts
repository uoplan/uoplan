import {
  findBestMatchingProgram,
  processExtractedPages,
  type PdfPageText,
} from "@/lib/parseTranscriptNative";

function textPage(pageText: string): PdfPageText {
  return { pageText, itemsWithPosition: [], hasPosition: false };
}

describe("parseTranscriptNative", () => {
  describe("processExtractedPages", () => {
    it("derives courses, full text, starting year, and stream hint from extracted pages", () => {
      const pages = [
        textPage(
          "Start of Transcript 2025 Winter\nProgram: French Immersion Stream\nCourse CSI 2101",
        ),
        textPage("Second page has MAT1341 and repeated csi 2101 plus ITD 1100"),
      ];

      expect(processExtractedPages(pages)).toEqual({
        courses: ["CSI 2101", "MAT 1341"],
        fullText: pages.map((page) => page.pageText).join("\n"),
        startingYear: 2024,
        frenchImmersionStreamHint: true,
      });
    });

    it("reconstructs positioned table rows into normalized course codes", () => {
      const courses = processExtractedPages([
        {
          pageText: "Course Credits Grade",
          hasPosition: true,
          itemsWithPosition: [
            { str: "2101", x: 120, y: 700 },
            { str: "CSI", x: 40, y: 702 },
            { str: "1100", x: 120, y: 620 },
            { str: "ITD", x: 40, y: 620 },
          ],
        },
      ]).courses;

      expect(courses).toEqual(["CSI 2101"]);
    });
  });

  describe("findBestMatchingProgram", () => {
    it("matches the latest semester program from the transcript header", () => {
      const programs = [
        { title: "Honours BSc Computer Science", url: "/programs/computer-science" },
        { title: "Honours BSc Mathematics", url: "/programs/mathematics" },
      ];

      const { program } = findBestMatchingProgram(
        "2024 Winter Term Honours Bachelor of Science in Computer Science Course Description Grade",
        programs,
      );

      expect(program).toEqual(programs[0]);
    });
  });
});
